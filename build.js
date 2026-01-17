
// build.js
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file build.js
 * @description Script de orquestração de build e servidor de desenvolvimento (DevServer).
 * 
 * [BUILD ENVIRONMENT / NODE.JS CONTEXT]:
 * Este código roda no ambiente Node.js (Local ou CI/CD), NÃO no navegador.
 * 
 * RESPONSABILIDADE:
 * 1. Compilação TypeScript -> JavaScript (ESM) usando esbuild.
 * 2. Gestão de Assets Estáticos (HTML, CSS, JSON, SVG).
 * 3. Versionamento Automático do Service Worker (Cache Busting).
 * 4. Servidor de Desenvolvimento com suporte a SPA, Service Workers E Mock de API Serverless.
 * 
 * ARQUITETURA CRÍTICA:
 * - Multi-Entry Bundling: Separa 'bundle' (UI Main Thread) e 'sync-worker' (Worker Thread).
 * - Injection: Define variáveis de ambiente (NODE_ENV) em tempo de build.
 * - API Proxy/Mock: Intercepta requisições /api/ localmente para simular Vercel Functions.
 */

const esbuild = require('esbuild');
const fs = require('fs/promises'); // API de sistema de arquivos baseada em Promises
const fsSync = require('fs'); // [2025-02-23] API síncrona para watch e checks rápidos
const path = require('path'); 
const http = require('http');

const isProduction = process.env.NODE_ENV === 'production';
const outdir = 'public';

async function copyStaticFiles() {
    console.log('Copiando arquivos estáticos...');
    await fs.copyFile('index.html', path.join(outdir, 'index.html'));
    await fs.copyFile('manifest.json', path.join(outdir, 'manifest.json'));
    
    // Versionamento Dinâmico do Service Worker
    try {
        const swContent = await fs.readFile('sw.js', 'utf-8');
        const versionRegex = /const\s+CACHE_NAME\s*=\s*['"][^'"]+['"];/;
        
        if (versionRegex.test(swContent)) {
            const versionedSw = swContent.replace(
                versionRegex, 
                `const CACHE_NAME = 'habit-tracker-v${Date.now()}';`
            );
            await fs.writeFile(path.join(outdir, 'sw.js'), versionedSw);
        } else {
            console.warn('⚠️ AVISO: Padrão CACHE_NAME não encontrado em sw.js. O versionamento automático falhou.');
            await fs.copyFile('sw.js', path.join(outdir, 'sw.js'));
        }
    } catch (e) {
        console.error('Erro ao processar sw.js:', e);
        await fs.copyFile('sw.js', path.join(outdir, 'sw.js'));
    }

    try {
        await fs.cp('icons', path.join(outdir, 'icons'), { recursive: true });
        await fs.cp('locales', path.join(outdir, 'locales'), { recursive: true });
    } catch (err) {
        console.warn('Aviso ao copiar diretórios de assets:', err.message);
    }
    
    console.log('Arquivos estáticos copiados.');
}

function watchStaticFiles() {
    const pathsToWatch = ['index.html', 'manifest.json', 'sw.js', 'icons', 'locales'];
    console.log('Observando arquivos estáticos para mudanças...');

    pathsToWatch.forEach(p => {
        if (!fsSync.existsSync(p)) return;

        let debounceTimeout;
        try {
            fsSync.watch(p, { recursive: ['icons', 'locales'].includes(p) }, (eventType, filename) => {
                if (debounceTimeout) clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    console.log(`Mudança detectada em '${p}'. Recopiando...`);
                    copyStaticFiles().catch(err => console.error('Falha ao recopiar:', err));
                }, 100);
            });
        } catch (err) {
            console.warn(`Aviso: Não foi possível iniciar watch para ${p}.`, err.message);
        }
    });
}

const watchLoggerPlugin = {
    name: 'watch-logger',
    setup(build) {
        let startTime;
        build.onStart(() => {
            startTime = Date.now();
            console.log('Iniciando reconstrução do código-fonte...');
        });
        build.onEnd(result => {
            const duration = Date.now() - startTime;
            if (result.errors.length > 0) {
                console.error(`Reconstrução falhou após ${duration}ms.`);
            } else {
                console.log(`✅ Reconstrução do código-fonte concluída em ${duration}ms.`);
            }
        });
    },
};

// --- API MOCK SERVER HELPERS ---

const MOCK_DB_FILE = '.local-kv.json';

async function handleApiSync(req, res) {
    if (req.method === 'GET') {
        try {
            // Check for key hash header
            const keyHash = req.headers['x-sync-key-hash'];
            if (!keyHash) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Unauthorized' }));
            }

            if (!fsSync.existsSync(MOCK_DB_FILE)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end('null');
            }
            
            const db = JSON.parse(await fs.readFile(MOCK_DB_FILE, 'utf-8'));
            const userData = db[keyHash];
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(userData || null));
        } catch (e) {
            console.error('API Mock Error (GET /api/sync):', e);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
    } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const keyHash = req.headers['x-sync-key-hash'];
                if (!keyHash) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Unauthorized' }));
                }

                const payload = JSON.parse(body);
                
                let db = {};
                if (fsSync.existsSync(MOCK_DB_FILE)) {
                    db = JSON.parse(await fs.readFile(MOCK_DB_FILE, 'utf-8'));
                }
                
                const existingData = db[keyHash];
                
                // Optimistic Locking Check
                if (existingData && payload.lastModified < existingData.lastModified) {
                    res.writeHead(409, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify(existingData));
                }
                
                if (existingData && payload.lastModified === existingData.lastModified) {
                    res.writeHead(304); // Not Modified
                    return res.end();
                }

                // Save
                db[keyHash] = payload;
                await fs.writeFile(MOCK_DB_FILE, JSON.stringify(db, null, 2));
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                console.error('API Mock Error (POST /api/sync):', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else {
        res.writeHead(405);
        res.end();
    }
}

async function handleApiAnalyze(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end();
        return;
    }
    
    // Mock response for local development (no API Key required)
    // Returns a generic positive message to prove integration works.
    const mockResponse = "### Análise Local (Modo Desenvolvimento)\n\n**Estoicismo Simulado:**\n\nVocê está indo bem! A consistência é a chave. Continue praticando seus hábitos diários. Lembre-se: não é o que acontece com você, mas como você reage a isso.";
    
    // Simulate latency
    setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(mockResponse);
    }, 1500);
}


async function build() {
    try {
        console.log(`Iniciando build de ${isProduction ? 'produção' : 'desenvolvimento'}...`);
        console.log(`Limpando diretório de saída: ${outdir}...`);
        await fs.rm(outdir, { recursive: true, force: true });
        await fs.mkdir(outdir, { recursive: true });
        
        await copyStaticFiles();

        const esbuildOptions = {
            entryPoints: {
                'bundle': 'index.tsx',
                'sync-worker': 'services/sync.worker.ts'
            },
            bundle: true,
            outdir: outdir,
            entryNames: '[name]',
            format: 'esm',
            platform: 'browser',
            minify: isProduction,
            sourcemap: !isProduction,
            define: { 
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development') 
            }
        };
        
        if (isProduction) {
            console.log('Compilando aplicação para produção...');
            await esbuild.build(esbuildOptions);
            console.log(`\nBuild de produção concluído!`);
        } else {
            esbuildOptions.plugins = [watchLoggerPlugin];
            console.log('Configurando servidor de desenvolvimento...');
            const ctx = await esbuild.context(esbuildOptions);
            await ctx.watch();

            // Configura o servidor estático do esbuild
            const { host, port: esbuildPort } = await ctx.serve({
                servedir: outdir,
                fallback: 'index.html'
            });

            // Cria um Proxy Server customizado para interceptar API
            const devServer = http.createServer((req, res) => {
                // Intercept API requests
                if (req.url.startsWith('/api/sync')) {
                    return handleApiSync(req, res);
                }
                if (req.url.startsWith('/api/analyze')) {
                    return handleApiAnalyze(req, res);
                }

                // Forward all other requests to esbuild static server
                const options = {
                    hostname: host,
                    port: esbuildPort,
                    path: req.url,
                    method: req.method,
                    headers: req.headers,
                };

                const proxyReq = http.request(options, (proxyRes) => {
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                    proxyRes.pipe(res, { end: true });
                });

                req.pipe(proxyReq, { end: true });
            });

            const DEV_PORT = 8000;
            devServer.listen(DEV_PORT, () => {
                console.log(`\n🚀 Servidor Dev iniciado em http://localhost:${DEV_PORT}`);
                console.log(`✨ API Mock ativa em /api/*`);
                watchStaticFiles();
            });

            const handleExit = async () => {
                console.log('\nEncerrando...');
                devServer.close();
                await ctx.dispose();
                process.exit(0);
            };
            process.on('SIGINT', handleExit);
            process.on('SIGTERM', handleExit);
        }

    } catch (e) {
        console.error('O build falhou:', e);
        process.exit(1);
    }
}

build();
