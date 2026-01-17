
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file services/persistence.ts
 * @description Camada de Persistência Local (IndexedDB Wrapper).
 */

import { 
    state, 
    AppState, 
    APP_VERSION,
    getPersistableState 
} from '../state';
import { migrateState } from './migration';

// CONFIGURAÇÃO DO INDEXEDDB
const DB_NAME = 'AskesisDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
const STATE_KEY = 'latest_state';
const LEGACY_STORAGE_KEY = 'habitTrackerState_v1';

// --- IDB UTILS ---

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            try {
                // SECURITY FIX: indexedDB.open lança erro síncrono em contextos inseguros (ex: Firefox Private).
                if (typeof indexedDB === 'undefined') {
                    reject(new Error("IndexedDB not supported or restricted"));
                    return;
                }

                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME);
                    }
                };
                request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
                request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
            } catch (e) {
                // Captura SecurityError síncrono
                console.warn("Persistence disabled due to security restrictions:", e);
                reject(e);
            }
        });
    }
    return dbPromise;
}

async function idbGet<T>(key: string): Promise<T | undefined> {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        // Falha silenciosa para permitir funcionamento em memória
        console.warn("IDB Get skipped:", e);
        return undefined;
    }
}

async function idbPut(key: string, value: any): Promise<void> {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn("IDB Put skipped:", e);
    }
}

async function idbClear(): Promise<void> {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn("IDB Clear skipped:", e);
    }
}

// --- PUBLIC API ---

let syncHandler: ((state: AppState) => void) | null = null;

export function registerSyncHandler(handler: (state: AppState) => void) {
    syncHandler = handler;
}

export async function persistStateLocally(appState: AppState): Promise<void> {
    await idbPut(STATE_KEY, appState);
}

export async function loadState(initialStateOverride?: AppState): Promise<AppState | null> {
    if (initialStateOverride) {
        Object.assign(state, initialStateOverride);
        return initialStateOverride;
    }

    let loaded: AppState | undefined;
    try {
        loaded = await idbGet<AppState>(STATE_KEY);
    } catch (e) {
        console.error("IDB Read Error", e);
    }

    // Fallback: Check LocalStorage (Migration)
    if (!loaded) {
        try {
            const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacy) {
                try {
                    loaded = JSON.parse(legacy);
                    console.log("Migrated from LocalStorage to IndexedDB");
                } catch (e) {
                    console.error("Legacy Storage Parse Error", e);
                }
            }
        } catch (e) {
            // SECURITY FIX: Captura erro ao acessar localStorage se cookies estiverem bloqueados
            console.warn("Legacy localStorage access blocked:", e);
        }
    }

    if (loaded) {
        const migrated = migrateState(loaded, APP_VERSION);
        Object.assign(state, migrated);
        return migrated;
    }
    return null;
}

export async function saveState() {
    const s = getPersistableState();
    await persistStateLocally(s);
    if (syncHandler) {
        syncHandler(s);
    }
}

export async function clearLocalPersistence() {
    await idbClear();
    try {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (e) {
        console.warn("Failed to clear legacy storage:", e);
    }
}
