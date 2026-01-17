
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file data/quotes.ts
 * @description Banco de Dados Estático de sabedoria estoica (Citações).
 * 
 * [SHARED RESOURCE / LAZY LOAD TARGET]:
 * Este módulo contém uma grande quantidade de dados textuais (Strings).
 * 
 * CONTEXTO ARQUITETURAL:
 * 1. **Responsabilidade Única:** Prover conteúdo curado, traduzido e semanticamente taggeado.
 *    Atua como a "Alma" da aplicação, sem dependências lógicas.
 * 2. **Estratégia de Carregamento (Performance):** Devido ao tamanho deste array, este arquivo é
 *    projetado para ser importado dinamicamente (`await import(...)`) no `render.ts`.
 *    Isso remove o peso do texto do bundle inicial (Critical Path), melhorando o TTI (Time to Interactive).
 * 3. **Integridade de Dados:** A precisão das traduções e atribuições é crítica para a credibilidade
 *    do app ("Askesis" = Treinamento).
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - Nenhuma dependência de importação (Leaf Node).
 * - Consumido por `render.ts` (função `renderStoicQuote`).
 */

// PERFORMANCE: Union Types de string literais são removidos na transpilação,
// gerando zero overhead de runtime, mas garantindo consistência semântica para filtros ou IA.
export type StoicTag = 
    | 'action' 
    | 'resilience' 
    | 'control' 
    | 'time' 
    | 'gratitude' 
    | 'discipline' 
    | 'temperance' 
    | 'nature' 
    | 'learning' 
    | 'humility' 
    | 'reality' 
    | 'suffering' 
    | 'focus' 
    | 'virtue' 
    | 'death' 
    | 'anxiety' 
    | 'community' 
    | 'perception' 
    | 'change' 
    | 'wisdom' 
    | 'perspective' 
    | 'responsibility' 
    | 'morning' 
    | 'evening' 
    | 'reflection' 
    | 'duty' 
    | 'rest' 
    | 'consistency' 
    | 'presence' 
    | 'fate' 
    | 'simplicity' 
    | 'healing' 
    | 'mindset' 
    | 'life' 
    | 'love' 
    | 'laziness' 
    | 'preparation' 
    | 'prudence' 
    | 'peace' 
    | 'courage' 
    | 'confidence' 
    | 'growth' 
    | 'character' 
    | 'solitude' 
    | 'justice' 
    | 'silence' 
    | 'optimism' 
    | 'creativity' 
    | 'passion' 
    | 'reason' 
    | 'history' 
    | 'wealth' 
    | 'happiness' 
    | 'leadership' 
    | 'truth' 
    | 'freedom' 
    | 'acceptance' 
    | 'integrity' 
    | 'minimalism' 
    | 'purpose' 
    | 'legacy' 
    | 'fear' 
    | 'belief' 
    | 'identity' 
    | 'practice' 
    | 'authenticity' 
    | 'example' 
    | 'desire' 
    | 'habit' 
    | 'listening' 
    | 'values' 
    | 'criticism' 
    | 'urgency' 
    | 'patience' 
    | 'strength' 
    | 'honor' 
    | 'essentialism' 
    | 'flow' 
    | 'health' 
    | 'hope' 
    | 'speech' 
    | 'body' 
    | 'mindfulness' 
    | 'friendship' 
    | 'anger' 
    | 'kindness';

export type Quote = {
    pt: string;
    en: string;
    es: string;
    author: string;
    tags: StoicTag[];
};

// DO NOT REFACTOR: Este array é a fonte da verdade. 
// A estrutura deve ser mantida plana (Flat Array) para facilitar a seleção aleatória O(1) via índice.
// A curated list of Stoic quotes with Semantic Tags
export const STOIC_QUOTES: Quote[] = [
    // --- CLEANTHES (The Devout - Acceptance of Fate) ---
    {
        pt: "Conduza-me, ó Zeus, e tu, Destino, para onde quer que tenhas me ordenado.",
        en: "Lead me, O Zeus, and thou O Destiny, The way that I am bid by you to go.",
        es: "Condúceme, oh Zeus, y tú, Destino, hacia donde me hayas ordenado.",
        author: "cleanthes",
        tags: ['fate', 'acceptance', 'nature']
    },
    {
        pt: "Aquele que obedece aos deuses voluntariamente é sábio e conhece os planos divinos.",
        en: "Who so is obedient to the gods with a will, He is wise and knows the divine plans.",
        es: "Quien obedece a los dioses voluntariamente es sabio y conoce los planes divinos.",
        author: "cleanthes",
        tags: ['wisdom', 'nature']
    },
    {
        pt: "O destino guia quem o aceita e arrasta quem o rejeita.",
        en: "Fate guides the willing, but drags the unwilling.",
        es: "El destino guía a quien lo acepta y arrastra a quien lo rechaza.",
        author: "cleanthes",
        tags: ['fate', 'resilience', 'reality']
    },
    {
        pt: "A virtude é a única coisa que faz a vida valer a pena.",
        en: "Virtue is the only thing that makes life worth living.",
        es: "La virtud es lo único que hace que la vida valga la pena.",
        author: "cleanthes",
        tags: ['virtue', 'focus']
    },
    {
        pt: "Não há nada mais poderoso do que a necessidade.",
        en: "There is nothing more powerful than necessity.",
        es: "No hay nada más poderoso que la necesidad.",
        author: "cleanthes",
        tags: ['reality', 'nature']
    },
    {
        pt: "O prazer não é um bem, nem a natureza o busca como um fim.",
        en: "Pleasure is not a good, nor does nature seek it as an end.",
        es: "El placer no es un bien, ni la naturaleza lo busca como un fin.",
        author: "cleanthes",
        tags: ['temperance', 'nature', 'virtue']
    },
    {
        pt: "Olhe para a ordem dos céus e aprenda a ordem da sua própria alma.",
        en: "Look at the order of the heavens and learn the order of your own soul.",
        es: "Mira el orden de los cielos y aprende el orden de tu propia alma.",
        author: "cleanthes",
        tags: ['nature', 'wisdom', 'perspective']
    },
    {
        pt: "A lei universal guia todas as coisas corretamente.",
        en: "The universal law guides all things rightly.",
        es: "La ley universal guía todas las cosas correctamente.",
        author: "cleanthes",
        tags: ['nature', 'justice', 'fate']
    },
    {
        pt: "Pobre é aquele que deseja muito, não aquele que tem pouco.",
        en: "Poor is he who desires much, not he who has little.",
        es: "Pobre es el que desea mucho, no el que tiene poco.",
        author: "cleanthes",
        tags: ['wealth', 'temperance', 'desire']
    },
    {
        pt: "A sabedoria é o conhecimento do que é divino e humano.",
        en: "Wisdom is the knowledge of things divine and human.",
        es: "La sabiduría es el conocimiento de las cosas divinas y humanas.",
        author: "cleanthes",
        tags: ['wisdom', 'learning']
    },
    {
        pt: "A ignorância é a causa da dor e do medo.",
        en: "Ignorance is the cause of pain and fear.",
        es: "La ignorancia es la causa del dolor y del miedo.",
        author: "cleanthes",
        tags: ['fear', 'suffering', 'wisdom']
    },
    {
        pt: "A verdadeira liberdade é servir à Razão.",
        en: "True freedom is serving Reason.",
        es: "La verdadera libertad es servir a la Razón.",
        author: "cleanthes",
        tags: ['freedom', 'reason', 'discipline']
    },

    // --- ZENO OF CITIUM (The Founder) ---
    {
        pt: "O bem-estar é alcançado através de pequenos passos, mas não é uma coisa pequena.",
        en: "Well-being is realized by small steps, but is truly no small thing.",
        es: "El bienestar se logra con pequeños pasos, pero no es algo pequeño.",
        author: "zeno",
        tags: ['action', 'discipline', 'learning', 'consistency']
    },
    {
        pt: "Temos dois ouvidos e uma boca, para que possamos ouvir mais e falar menos.",
        en: "We have two ears and one mouth, so we should listen more than we say.",
        es: "Tenemos dos oídos y una boca, para escuchar más de lo que hablamos.",
        author: "zeno",
        tags: ['humility', 'learning', 'listening']
    },
    {
        pt: "O homem conquista o mundo conquistando a si mesmo.",
        en: "Man conquers the world by conquering himself.",
        es: "El hombre conquista el mundo conquistándose a sí mismo.",
        author: "zeno",
        tags: ['discipline', 'control']
    },
    {
        pt: "A felicidade é um bom fluxo de vida.",
        en: "Happiness is a good flow of life.",
        es: "La felicidad es un buen flujo de vida.",
        author: "zeno",
        tags: ['nature', 'learning', 'flow']
    },
    {
        pt: "Melhor tropeçar com os pés do que com a língua.",
        en: "Better to trip with the feet than with the tongue.",
        es: "Mejor tropezar con los pies que con la lengua.",
        author: "zeno",
        tags: ['temperance', 'humility']
    },
    {
        pt: "O aço é polido pelo fogo; o homem, pela adversidade.",
        en: "Steel is polished by fire; man, by adversity.",
        es: "El acero se pule con fuego; el hombre, con la adversidad.",
        author: "zeno",
        tags: ['resilience', 'suffering']
    },
    {
        pt: "Nenhum perca é maior que a do tempo.",
        en: "No loss is greater than that of time.",
        es: "Ninguna pérdida es mayor que la del tiempo.",
        author: "zeno",
        tags: ['time']
    },
    {
        pt: "Quando um cachorro late para a lua, a lua não late de volta.",
        en: "When a dog barks at the moon, the moon does not bark back.",
        es: "Cuando un perro le ladra a la luna, la luna no le devuelve el ladrido.",
        author: "zeno",
        tags: ['control', 'temperance']
    },
    {
        pt: "A tranquilidade nada mais é do que a boa ordenação da mente.",
        en: "Tranquility is nothing else than the good ordering of the mind.",
        es: "La tranquilidad no es más que el buen orden de la mente.",
        author: "zeno",
        tags: ['peace', 'mindset']
    },
    {
        pt: "O objetivo da vida é viver em acordo com a natureza.",
        en: "The goal of life is living in agreement with nature.",
        es: "El objetivo de la vida es vivir de acuerdo con la naturaleza.",
        author: "zeno",
        tags: ['nature', 'purpose']
    },
    {
        pt: "A extravagância é a sua própria destruidora.",
        en: "Extravagance is its own destroyer.",
        es: "La extravagancia es su propia destructora.",
        author: "zeno",
        tags: ['temperance', 'wealth']
    },
    {
        pt: "Todos os bons são amigos uns dos outros.",
        en: "All the good are friends of one another.",
        es: "Todos los buenos son amigos entre sí.",
        author: "zeno",
        tags: ['community', 'virtue']
    },
    {
        pt: "Siga a razão onde quer que ela o leve.",
        en: "Follow where reason leads.",
        es: "Sigue a donde la razón te lleve.",
        author: "zeno",
        tags: ['reason', 'wisdom', 'action']
    },
    {
        pt: "A voz da verdade é simples.",
        en: "The voice of truth is simple.",
        es: "La voz de la verdad es simple.",
        author: "zeno",
        tags: ['truth', 'simplicity']
    },
    {
        pt: "A sorte não é senão uma cadeia de causas.",
        en: "Chance is nothing but a chain of causes.",
        es: "El azar no es más que una cadena de causas.",
        author: "zeno",
        tags: ['fate', 'reality']
    },
    {
        pt: "Um sentimento ruim é uma comoção da mente repugnante à razão.",
        en: "A bad feeling is a commotion of the mind repugnant to reason.",
        es: "Un mal sentimiento es una conmoción de la mente repugnante a la razón.",
        author: "zeno",
        tags: ['anxiety', 'control', 'reason']
    },
    {
        pt: "Nada é mais hostil à firmeza de propósito do que a ociosidade.",
        en: "Nothing is more hostile to a firm grasp on purpose than idleness.",
        es: "Nada es más hostil a la firmeza de propósito que la ociosidad.",
        author: "zeno",
        tags: ['action', 'focus', 'laziness']
    },
    {
        pt: "O destino é a razão do universo.",
        en: "Fate is the reason of the universe.",
        es: "El destino es la razón del universo.",
        author: "zeno",
        tags: ['fate', 'nature', 'wisdom']
    },
    {
        pt: "A virtude é suficiente para a felicidade.",
        en: "Virtue is sufficient for happiness.",
        es: "La virtud es suficiente para la felicidad.",
        author: "zeno",
        tags: ['virtue', 'happiness', 'simplicity']
    },

    // --- MUSONIUS RUFUS (The Teacher) ---
    {
        pt: "A teoria é boa, mas a prática é melhor. Nós não aprendemos a virtude apenas lendo, mas fazendo.",
        en: "Theory is good, but practice is better. We do not learn virtue by reading, but by doing.",
        es: "La teoría es buena, pero la práctica es mejor. No aprendemos la virtud leyendo, sino haciendo.",
        author: "musoniusRufus",
        tags: ['action', 'discipline', 'learning']
    },
    {
        pt: "Se você realizar algo bom com trabalho duro, o trabalho passa, mas o bem permanece.",
        en: "If you accomplish something good with hard work, the labor passes, but the good remains.",
        es: "Si logras algo bueno con trabajo duro, el trabajo pasa, pero el bien permanece.",
        author: "musoniusRufus",
        tags: ['resilience', 'action', 'discipline']
    },
    {
        pt: "Se você fizer algo vergonhoso em busca de prazer, o prazer passa, mas a vergonha permanece.",
        en: "If you do something shameful in pursuit of pleasure, the pleasure passes, but the shame remains.",
        es: "Si haces algo vergonzoso en busca de placer, el placer pasa, pero la vergüenza permanece.",
        author: "musoniusRufus",
        tags: ['temperance', 'discipline']
    },
    {
        pt: "Para viver bem, não precisamos de mais coisas, mas de mais disciplina.",
        en: "To live well, we do not need more things, but more discipline.",
        es: "Para vivir bien, no necesitamos más cosas, sino más disciplina.",
        author: "musoniusRufus",
        tags: ['discipline', 'temperance', 'simplicity']
    },
    {
        pt: "A alma é corrompida pelo prazer tanto quanto pela dor.",
        en: "The soul is corrupted by pleasure just as much as by pain.",
        es: "El alma se corrompe por el placer tanto como por el dolor.",
        author: "musoniusRufus",
        tags: ['temperance', 'control']
    },
    {
        pt: "Assim como não se deve tentar curar os olhos sem curar a cabeça, nem a cabeça sem o corpo, assim também não se deve tentar curar o corpo sem a alma.",
        en: "Just as one should not attempt to cure the eyes without curing the head, or the head without the body, so neither should one attempt to cure the body without the soul.",
        es: "Así como no se debe intentar curar los ojos sin curar la cabeza, ni la cabeza sin el cuerpo, tampoco se debe intentar curar el cuerpo sin el alma.",
        author: "musoniusRufus",
        tags: ['nature', 'discipline']
    },
    {
        pt: "Você vai ganhar o respeito de todos se começar por ganhar o respeito de si mesmo.",
        en: "You will earn the respect of all if you begin by earning the respect of yourself.",
        es: "Te ganarás el respeto de todos si comienzas por ganarte el respeto de ti mismo.",
        author: "musoniusRufus",
        tags: ['discipline', 'humility']
    },
    {
        pt: "A humanidade deve buscar o que é certo, não o que é fácil.",
        en: "Humanity must seek what is right, not what is easy.",
        es: "La humanidad debe buscar lo que es correcto, no lo que es fácil.",
        author: "musoniusRufus",
        tags: ['virtue', 'discipline']
    },
    {
        pt: "Não devemos nos preocupar em viver muito, mas em viver nobremente.",
        en: "We should not worry about living long, but about living nobly.",
        es: "No debemos preocuparnos por vivir mucho, sino por vivir noblemente.",
        author: "musoniusRufus",
        tags: ['virtue', 'time']
    },
    {
        pt: "Relaxe sua mente de tempos em tempos, mas não a deixe afrouxar totalmente.",
        en: "Relax your mind from time to time, but do not let it loosen entirely.",
        es: "Relaja tu mente de vez en cuando, pero no dejes que se afloje por completo.",
        author: "musoniusRufus",
        tags: ['rest', 'temperance']
    },
    {
        pt: "Você nunca encontrará um melhor professor de autocontrole do que a fome.",
        en: "You will never find a better teacher of self-control than hunger.",
        es: "Nunca encontrarás un mejor maestro de autocontrol que el hambre.",
        author: "musoniusRufus",
        tags: ['temperance', 'discipline', 'suffering']
    },
    {
        pt: "Devemos dominar nossos apetites de comida e bebida, pois eles são a base do autocontrole.",
        en: "We must master our appetites for food and drink, for they are the foundation of self-control.",
        es: "Debemos dominar nuestros apetitos de comida y bebida, pues son la base del autocontrol.",
        author: "musoniusRufus",
        tags: ['temperance', 'health', 'control']
    },
    {
        pt: "O exílio não é um mal. Onde quer que você vá, você leva sua própria virtude.",
        en: "Exile is not an evil. Wherever you go, you take your own virtue.",
        es: "El exilio no es un mal. Dondequiera que vayas, llevas tu propia virtud.",
        author: "musoniusRufus",
        tags: ['resilience', 'change', 'virtue']
    },
    {
        pt: "Por que criticamos os tiranos? Porque eles tratam os outros como escravos. Por que então agimos como tiranos em nossas próprias casas?",
        en: "Why do we criticize tyrants? Because they treat others as slaves. Why then do we act like tyrants in our own homes?",
        es: "¿Por qué criticamos a los tiranos? Porque tratan a los demás como esclavos. ¿Por qué entonces actuamos como tiranos en nuestros propios hogares?",
        author: "musoniusRufus",
        tags: ['community', 'justice', 'humility']
    },
    {
        pt: "O ser humano nasce com uma inclinação para a virtude.",
        en: "The human being is born with an inclination toward virtue.",
        es: "El ser humano nace con una inclinación hacia la virtud.",
        author: "musoniusRufus",
        tags: ['nature', 'virtue', 'hope']
    },
    {
        pt: "É impossível viver bem hoje a menos que você o trate como seu último dia.",
        en: "It is not possible to live well today unless you treat it as your last day.",
        es: "No es posible vivir bien hoy a menos que lo trates como tu último día.",
        author: "musoniusRufus",
        tags: ['death', 'time', 'focus']
    },
    {
        pt: "Começamos a perder nossa hesitação em fazer coisas imorais quando perdemos nossa hesitação em falar sobre elas.",
        en: "We begin to lose our hesitation to do immoral things when we lose our hesitation to speak of them.",
        es: "Comenzamos a perder nuestra vacilación para hacer cosas inmorales cuando perdemos nuestra vacilación para hablar de ellas.",
        author: "musoniusRufus",
        tags: ['integrity', 'character', 'speech']
    },
    {
        pt: "Aceitar a injúria sem espírito de retaliação demonstra uma alma gentil e nobre.",
        en: "To accept injury without a spirit of retaliation argues a gentle and noble soul.",
        es: "Aceptar la injuria sin espíritu de represalia demuestra un alma gentil y noble.",
        author: "musoniusRufus",
        tags: ['resilience', 'community', 'peace']
    },
    {
        pt: "A riqueza capaz de comprar prazeres não é nada comparada à capacidade de dispensá-los.",
        en: "Wealth capable of buying pleasures is nothing compared to the ability to dispense with them.",
        es: "La riqueza capaz de comprar placeres no es nada comparada con la capacidad de prescindir de ellos.",
        author: "musoniusRufus",
        tags: ['wealth', 'temperance', 'freedom']
    },
    {
        pt: "Não devemos temer o trabalho, mas sim a inatividade e a preguiça.",
        en: "We should not fear work, but inactivity and laziness.",
        es: "No debemos temer el trabajo, sino la inactividad y la pereza.",
        author: "musoniusRufus",
        tags: ['action', 'laziness', 'discipline']
    },
    {
        pt: "Quem treina o corpo sem treinar a alma, treina apenas a carcaça.",
        en: "He who trains the body without training the soul, trains only the shell.",
        es: "Quien entrena el cuerpo sin entrenar el alma, entrena solo la carcasa.",
        author: "musoniusRufus",
        tags: ['discipline', 'wisdom', 'body']
    },
    {
        pt: "Não é o que comemos que importa, mas como comemos.",
        en: "It is not what we eat that matters, but how we eat.",
        es: "No es lo que comemos lo que importa, sino cómo comemos.",
        author: "musoniusRufus",
        tags: ['temperance', 'health', 'mindfulness']
    },
    {
        pt: "A virtude não é dada por nascimento, mas adquirida pela prática.",
        en: "Virtue is not given by birth, but acquired by practice.",
        es: "La virtud no se da por nacimiento, sino que se adquiere con la práctica.",
        author: "musoniusRufus",
        tags: ['virtue', 'action', 'growth']
    },

    // --- MARCO AURÉLIO (The Emperor) ---
    {
        pt: "A felicidade da sua vida depende da qualidade dos seus pensamentos.",
        en: "The happiness of your life depends upon the quality of your thoughts.",
        es: "La felicidad de tu vida depende de la calidad de tus pensamientos.",
        author: "marcusAurelius",
        tags: ['control', 'resilience', 'perception']
    },
    {
        pt: "O obstáculo à ação avança a ação. O que fica no caminho se torna o caminho.",
        en: "The impediment to action advances action. What stands in the way becomes the way.",
        es: "El impedimento a la acción avanza la acción. Lo que se interpone en el camino se convierte en el camino.",
        author: "marcusAurelius",
        tags: ['resilience', 'action', 'suffering']
    },
    {
        pt: "Não aja como se fosse viver dez mil anos. A morte paira sobre você.",
        en: "Do not act as if you were going to live ten thousand years. Death hangs over you.",
        es: "No actúes como si fueras a vivir diez mil años. La muerte se cierne sobre ti.",
        author: "marcusAurelius",
        tags: ['time', 'action', 'death']
    },
    {
        pt: "Ao acordar de manhã, pense no precioso privilégio que é estar vivo.",
        en: "When you arise in the morning, think of what a precious privilege it is to be alive.",
        es: "Cuando te levantes por la mañana, piensa en el precioso privilegio que es estar vivo.",
        author: "marcusAurelius",
        tags: ['gratitude', 'nature', 'morning']
    },
    {
        pt: "Para que fui feito? Para deitar sob os cobertores e me manter aquecido?",
        en: "For what was I created? To lie under the blankets and keep warm?",
        es: "¿Para qué fui creado? ¿Para yacer bajo las mantas y mantenerme caliente?",
        author: "marcusAurelius",
        tags: ['morning', 'action', 'discipline']
    },
    {
        pt: "A arte de viver assemelha-se mais à luta do que à dança.",
        en: "The art of living is more like wrestling than dancing.",
        es: "El arte de vivir se asemeja más a la lucha que a la danza.",
        author: "marcusAurelius",
        tags: ['resilience', 'discipline', 'suffering']
    },
    {
        pt: "Se não é certo, não faça; se não é verdade, não diga.",
        en: "If it is not right do not do it; if it is not true do not say it.",
        es: "Si no es correcto, no lo hagas; si no es verdad, no lo digas.",
        author: "marcusAurelius",
        tags: ['discipline', 'action', 'virtue']
    },
    {
        pt: "Tudo o que ouvimos é uma opinião, não um fato. Tudo o que vemos é uma perspectiva, não a verdade.",
        en: "Everything we hear is an opinion, not a fact. Everything we see is a perspective, not the truth.",
        es: "Todo lo que escuchamos es una opinión, no un hecho. Todo lo que vemos es una perspectiva, no la verdad.",
        author: "marcusAurelius",
        tags: ['control', 'learning', 'perception']
    },
    {
        pt: "Aceite as coisas a que o destino te liga, mas faça-o de todo o coração.",
        en: "Accept the things to which fate binds you, but do so with all your heart.",
        es: "Acepta las cosas a las que el destino te ata, pero hazlo con todo tu corazón.",
        author: "marcusAurelius",
        tags: ['resilience', 'nature', 'fate']
    },
    {
        pt: "Você tem poder sobre sua mente - não sobre eventos externos. Perceba isso e você encontrará força.",
        en: "You have power over your mind - not outside events. Realize this, and you will find strength.",
        es: "Tienes poder sobre tu mente, no sobre los acontecimientos externos. Date cuenta de esto y encontrarás la fuerza.",
        author: "marcusAurelius",
        tags: ['control', 'resilience', 'anxiety']
    },
    {
        pt: "A melhor vingança é não ser como o seu inimigo.",
        en: "The best revenge is to be unlike him who performed the injury.",
        es: "La mejor venganza es ser diferente a quien causó el daño.",
        author: "marcusAurelius",
        tags: ['temperance', 'discipline']
    },
    {
        pt: "Não perca mais tempo discutindo sobre o que um bom homem deve ser. Seja um.",
        en: "Waste no more time arguing about what a good man should be. Be one.",
        es: "No pierdas más tiempo discutiendo sobre cómo debe ser un buen hombre. Sé uno.",
        author: "marcusAurelius",
        tags: ['action', 'discipline', 'virtue']
    },
    {
        pt: "A alma se tinge com a cor dos seus pensamentos.",
        en: "The soul becomes dyed with the color of its thoughts.",
        es: "El alma se tiñe del color de sus pensamientos.",
        author: "marcusAurelius",
        tags: ['control', 'learning', 'perception']
    },
    {
        pt: "O homem ambicioso vê a honra na ação dos outros; o homem de prazer nas suas próprias sensações; o homem de entendimento na sua própria ação.",
        en: "The ambitious man places his honor in the action of others; the man of pleasure in his own sensation; the man of understanding in his own action.",
        es: "El hombre ambicioso ve el honor en la acción de los demás; el hombre de placer en sus propias sensaciones; el hombre de entendimiento en su propia acción.",
        author: "marcusAurelius",
        tags: ['action', 'humility']
    },
    {
        pt: "Olhe para dentro. A fonte do bem está lá, e surgirá sempre se você cavar.",
        en: "Look within. Within is the fountain of good, and it will ever bubble up, if thou wilt ever dig.",
        es: "Mira en tu interior. Dentro está la fuente del bien, y siempre brotará si siempre cavas.",
        author: "marcusAurelius",
        tags: ['nature', 'learning']
    },
    {
        pt: "A morte sorri para todos nós; tudo o que um homem pode fazer é sorrir de volta.",
        en: "Death smiles at us all, all a man can do is smile back.",
        es: "La muerte nos sonríe a todos, todo lo que un hombre puede hacer es devolverle la sonrisa.",
        author: "marcusAurelius",
        tags: ['nature', 'resilience', 'time', 'death']
    },
    {
        pt: "O que não é bom para a colmeia, não pode ser bom para a abelha.",
        en: "That which is not good for the bee-hive, cannot be good for the bee.",
        es: "Lo que no es bueno para la colmena, no puede ser bueno para la abeja.",
        author: "marcusAurelius",
        tags: ['nature', 'humility', 'community']
    },
    {
        pt: "Rejeite seu senso de lesão e a própria lesão desaparece.",
        en: "Reject your sense of injury and the injury itself disappears.",
        es: "Rechaza tu sentido de la herida y la herida misma desaparece.",
        author: "marcusAurelius",
        tags: ['control', 'resilience', 'perception']
    },
    {
        pt: "A primeira regra é manter o espírito tranquilo. A segunda é olhar as coisas de frente e saber o que elas são.",
        en: "The first rule is to keep an untroubled spirit. The second is to look things in the face and know them for what they are.",
        es: "La primera regla es mantener el espíritu tranquilo. La segunda es mirar las cosas de frente y saber lo que son.",
        author: "marcusAurelius",
        tags: ['control', 'reality', 'temperance']
    },
    {
        pt: "Seja como o promontório contra o qual as ondas quebram continuamente; mas ele permanece firme e doma a fúria da água ao seu redor.",
        en: "Be like the promontory against which the waves continually break, but it stands firm and tames the fury of the water around it.",
        es: "Sé como el promontorio contra el que las olas rompen continuamente; pero él se mantiene firme y doma la furia del agua a su alrededor.",
        author: "marcusAurelius",
        tags: ['resilience', 'suffering']
    },
    {
        pt: "Perda nada mais é do que mudança, e mudança é o deleite da natureza.",
        en: "Loss is nothing else but change, and change is Nature's delight.",
        es: "La pérdida no es más que cambio, y el cambio es el deleite de la naturaleza.",
        author: "marcusAurelius",
        tags: ['nature', 'reality', 'change']
    },
    {
        pt: "Quanta vantagem ganha aquele que não olha para o que o vizinho diz, faz ou pensa, mas apenas para o que ele mesmo faz, para torná-lo justo e santo.",
        en: "How much time he gains who does not look to see what his neighbour says or does or thinks, but only at what he does himself, to make it just and holy.",
        es: "Cuánto tiempo gana el que no mira lo que dice, hace o piensa su vecino, sino solo lo que hace él mismo, para hacerlo justo y santo.",
        author: "marcusAurelius",
        tags: ['focus', 'discipline', 'time']
    },
    {
        pt: "Nada acontece a qualquer homem que ele não seja formado pela natureza para suportar.",
        en: "Nothing happens to any man that he is not formed by nature to bear.",
        es: "Nada le sucede a ningún hombre que no esté formado por la naturaleza para soportar.",
        author: "marcusAurelius",
        tags: ['nature', 'resilience']
    },
    {
        pt: "Hoje escapei da ansiedade. Ou melhor, eu a descartei, pois estava dentro de mim, em minhas próprias percepções - não fora.",
        en: "Today I escaped anxiety. Or no, I discarded it, because it was within me, in my own perceptions — not outside.",
        es: "Hoy escapé de la ansiedad. O no, la descarté, porque estaba dentro de mí, en mis propias percepciones, no fuera.",
        author: "marcusAurelius",
        tags: ['anxiety', 'control', 'perception']
    },
    {
        pt: "Faça cada coisa na vida como se fosse a última.",
        en: "Do every act of your life as if it were your last.",
        es: "Haz cada cosa en la vida como si fuera la última.",
        author: "marcusAurelius",
        tags: ['death', 'action', 'focus']
    },
    {
        pt: "Concentre cada minuto como um romano - como um homem - em fazer o que está diante de você com seriedade precisa e genuína.",
        en: "Concentrate every minute like a Roman—like a man—on doing what's in front of you with precise and genuine seriousness.",
        es: "Concéntrate cada minuto como un romano, como un hombre, en hacer lo que tienes delante con seriedad precisa y genuina.",
        author: "marcusAurelius",
        tags: ['focus', 'action', 'duty']
    },
    {
        pt: "Você poderia deixar a vida agora. Deixe que isso determine o que você faz, diz e pensa.",
        en: "You could leave life right now. Let that determine what you do and say and think.",
        es: "Podrías dejar la vida ahora mismo. Deja que eso determine lo que haces, dices y piensas.",
        author: "marcusAurelius",
        tags: ['death', 'focus', 'time']
    },
    {
        pt: "Muitas vezes me perguntei como é que todo homem ama a si mesmo mais do que a todos os outros homens, mas dá menos valor à sua própria opinião do que à dos outros.",
        en: "I have often wondered how it is that every man loves himself more than all the rest of men, but yet sets less value on his own opinion of himself than on the opinion of others.",
        es: "A menudo me he preguntado cómo es que cada hombre se ama a sí mismo más que a todos los demás, pero valora menos su propia opinión que la de los demás.",
        author: "marcusAurelius",
        tags: ['perception', 'humility', 'control']
    },
    {
        pt: "Aquele que vive em harmonia consigo mesmo vive em harmonia com o universo.",
        en: "He who lives in harmony with himself lives in harmony with the universe.",
        es: "El que vive en armonía consigo mismo vive en armonía con el universo.",
        author: "marcusAurelius",
        tags: ['nature', 'wisdom', 'perspective']
    },
    {
        pt: "O universo é mudança; a vida é o que os nossos pensamentos fazem dela.",
        en: "The universe is change; our life is what our thoughts make it.",
        es: "El universo es cambio; la vida es lo que nuestros pensamientos hacen de ella.",
        author: "marcusAurelius",
        tags: ['change', 'perception', 'reality']
    },
    {
        pt: "Nunca deixe o futuro perturbá-lo. Você o encontrará, se necessário, com as mesmas armas da razão que hoje o armam contra o presente.",
        en: "Never let the future disturb you. You will meet it, if you have to, with the same weapons of reason which today arm you against the present.",
        es: "Nunca dejes que el futuro te perturbe. Lo enfrentarás, si es necesario, con las mismas armas de la razón que hoy te arman contra el presente.",
        author: "marcusAurelius",
        tags: ['anxiety', 'resilience', 'reason']
    },
    {
        pt: "Olhe para trás, para o passado, com seus impérios em mudança que surgiram e caíram, e você poderá prever o futuro.",
        en: "Look back over the past, with its changing empires that rose and fell, and you can foresee the future.",
        es: "Mira hacia atrás, al pasado, con sus imperios cambiantes que surgieron y cayeron, y podrás prever el futuro.",
        author: "marcusAurelius",
        tags: ['time', 'perspective', 'history']
    },
    {
        pt: "O que a mente pode conceber e acreditar, ela pode alcançar.",
        en: "What the mind can conceive and believe, it can achieve.",
        es: "Lo que la mente puede concebir y creer, puede lograr.",
        author: "marcusAurelius",
        tags: ['action', 'reality']
    },
    {
        pt: "Pense em si mesmo como morto. Você viveu sua vida. Agora, pegue o que sobrou e viva adequadamente.",
        en: "Think of yourself as dead. You have lived your life. Now take what's left and live it properly.",
        es: "Piensa en ti mismo como muerto. Has vivido tu vida. Ahora toma lo que queda y vívelo adecuadamente.",
        author: "marcusAurelius",
        tags: ['death', 'time', 'resilience', 'perspective']
    },
    {
        pt: "Não é a morte que um homem deve temer, mas ele deve temer nunca começar a viver.",
        en: "It is not death that a man should fear, but he should fear never beginning to live.",
        es: "No es a la muerte a lo que un hombre debe temer, sino que debe temer no empezar nunca a vivir.",
        author: "marcusAurelius",
        tags: ['death', 'fear', 'action', 'life']
    },
    {
        pt: "Muito pouco é necessário para ter uma vida feliz; está tudo dentro de você, na sua maneira de pensar.",
        en: "Very little is needed to make a happy life; it is all within yourself, in your way of thinking.",
        es: "Se necesita muy poco para tener una vida feliz; está todo dentro de ti, en tu forma de pensar.",
        author: "marcusAurelius",
        tags: ['happiness', 'minimalism', 'mindset', 'control']
    },
    {
        pt: "Ao acordar de manhã, diga a si mesmo: As pessoas com quem lidarei hoje serão intrometidas, ingratas, arrogantes, desonestas, ciumentas e rudes.",
        en: "When you wake up in the morning, tell yourself: The people I deal with today will be meddling, ungrateful, arrogant, dishonest, jealous, and surly.",
        es: "Al despertar por la mañana, dite a ti mismo: Las personas con las que trataré hoy serán entrometidas, ingratas, arrogantes, deshonestas, celosas y hoscas.",
        author: "marcusAurelius",
        tags: ['morning', 'community', 'patience', 'resilience', 'preparation']
    },
    {
        pt: "Limite-se ao presente.",
        en: "Confine yourself to the present.",
        es: "Limítate al presente.",
        author: "marcusAurelius",
        tags: ['focus', 'presence', 'time', 'anxiety']
    },
    {
        pt: "Receba sem orgulho, solte sem apego.",
        en: "Receive without conceit, release without struggle.",
        es: "Recibe sin orgullo, suelta sin apego.",
        author: "marcusAurelius",
        tags: ['humility', 'acceptance', 'fate']
    },
    {
        pt: "O pepino é amargo? Jogue-o fora. Há espinhos no caminho? Desvie-se. Isso é o suficiente.",
        en: "A cucumber is bitter? Throw it away. There are brambles in the path? Turn aside. That is enough.",
        es: "¿El pepino es amargo? Tíralo. ¿Hay zarzas en el camino? Desvíate. Eso es suficiente.",
        author: "marcusAurelius",
        tags: ['simplicity', 'reality', 'perception']
    },
    {
        pt: "Não deixe sua mente divagar sobre o que você não tem, mas conte as bênçãos que você já possui.",
        en: "Let not your mind run on what you lack as much as on what you have already.",
        es: "No dejes que tu mente divague sobre lo que no tienes, sino cuenta las bendiciones que ya posees.",
        author: "marcusAurelius",
        tags: ['gratitude', 'mindset', 'happiness']
    },
    {
        pt: "Porque uma coisa parece difícil para você, não pense que é impossível para qualquer um realizar.",
        en: "Because a thing seems difficult for you, do not think it impossible for anyone to accomplish.",
        es: "Porque una cosa te parezca difícil, no pienses que es imposible de lograr para cualquiera.",
        author: "marcusAurelius",
        tags: ['confidence', 'resilience', 'growth']
    },
    {
        pt: "Apenas faça a coisa certa. O resto não importa.",
        en: "Just that you do the right thing. The rest doesn't matter.",
        es: "Solo haz lo correcto. El resto no importa.",
        author: "marcusAurelius",
        tags: ['virtue', 'action', 'integrity', 'duty']
    },
    {
        pt: "Pare o que estiver fazendo por um momento e pergunte a si mesmo: Tenho medo da morte porque não poderei mais fazer isso?",
        en: "Stop whatever you're doing for a moment and ask yourself: Am I afraid of death because I won't be able to do this anymore?",
        es: "Detén lo que estés haciendo por un momento y pregúntate: ¿Tengo miedo a la muerte porque ya no podré hacer esto?",
        author: "marcusAurelius",
        tags: ['death', 'perspective', 'reflection']
    },
    {
        pt: "Seus dias estão contados. Use-os para abrir as janelas da sua alma para o sol.",
        en: "Your days are numbered. Use them to throw open the windows of your soul to the sun.",
        es: "Tus días están contados. Úsalos para abrir las ventanas de tu alma al sol.",
        author: "marcusAurelius",
        tags: ['time', 'action', 'purpose']
    },
    {
        pt: "A vida é curta. Isso é tudo o que há para dizer. Tire o que puder do presente – com sensatez, com justiça.",
        en: "Life is short. That's all there is to say. Get what you can from the present – thoughtfully, justly.",
        es: "La vida es corta. Eso es todo lo que hay que decir. Saca lo que puedas del presente, con sensatez, con justicia.",
        author: "marcusAurelius",
        tags: ['time', 'virtue', 'presence']
    },
    {
        pt: "Contente-se em parecer o que você realmente é.",
        en: "Be content to seem what you really are.",
        es: "Conténtate con parecer lo que realmente eres.",
        author: "marcusAurelius",
        tags: ['authenticity', 'humility', 'identity']
    },
    {
        pt: "Nada tem tanto poder de ampliar a mente quanto a capacidade de investigar sistemática e verdadeiramente tudo o que vem sob sua observação na vida.",
        en: "Nothing has such power to broaden the mind as the ability to investigate systematically and truly all that comes under thy observation in life.",
        es: "Nada tiene tanto poder para ampliar la mente como la capacidad de investigar sistemática y verdaderamente todo lo que cae bajo tu observación en la vida.",
        author: "marcusAurelius",
        tags: ['learning', 'wisdom', 'perception']
    },
    {
        pt: "Os homens existem uns para os outros. Ensine-os então ou suporte-os.",
        en: "Men exist for the sake of one another. Teach them then or bear with them.",
        es: "Los hombres existen los unos para los otros. Enséñales entonces o sopórtalos.",
        author: "marcusAurelius",
        tags: ['community', 'patience', 'leadership']
    },
    {
        pt: "Sempre que estiver prestes a apontar um defeito em alguém, faça a seguinte pergunta: Que defeito meu mais se assemelha ao que estou prestes a criticar?",
        en: "Whenever you are about to find fault with someone, ask yourself the following question: What fault of mine most nearly resembles the one I am about to criticize?",
        es: "Siempre que estés a punto de encontrar un defecto en alguien, hazte la siguiente pregunta: ¿Qué defecto mío se parece más al que estoy a punto de criticar?",
        author: "marcusAurelius",
        tags: ['humility', 'criticism', 'reflection']
    },
    {
        pt: "Não se entregue a sonhos de ter o que você não tem, mas conte as principais bênçãos que você possui.",
        en: "Do not indulge in dreams of having what you have not, but reckon up the chief of the blessings you do possess.",
        es: "No te entregues a sueños de tener lo que no tienes, sino cuenta las principales bendiciones que posees.",
        author: "marcusAurelius",
        tags: ['gratitude', 'desire', 'happiness']
    },
    {
        pt: "Olhe bem para dentro de si mesmo; há uma fonte de força que sempre brotará se você sempre olhar.",
        en: "Look well into oneself; there is a source of strength which will always spring up if thou wilt always look.",
        es: "Mira bien dentro de ti mismo; hay una fuente de fuerza que siempre brotará si siempre miras.",
        author: "marcusAurelius",
        tags: ['resilience', 'strength', 'reflection']
    },
    {
        pt: "Você pode cometer injustiça não fazendo nada.",
        en: "You can commit injustice by doing nothing.",
        es: "Puedes cometer injusticia no haciendo nada.",
        author: "marcusAurelius",
        tags: ['justice', 'action', 'responsibility']
    },
    {
        pt: "O objetivo da vida não é estar do lado da maioria, mas escapar de se encontrar nas fileiras dos insanos.",
        en: "The object of life is not to be on the side of the majority, but to escape finding oneself in the ranks of the insane.",
        es: "El objetivo de la vida no es estar del lado de la mayoría, sino escapar de encontrarse en las filas de los locos.",
        author: "marcusAurelius",
        tags: ['identity', 'wisdom', 'integrity']
    },
    {
        pt: "Viver uma boa vida: Temos o potencial para isso. Se pudermos aprender a ser indiferentes ao que não faz diferença.",
        en: "To live a good life: We have the potential for it. If we can learn to be indifferent to what makes no difference.",
        es: "Vivir una buena vida: Tenemos el potencial para ello. Si podemos aprender a ser indiferentes a lo que no hace diferencia.",
        author: "marcusAurelius",
        tags: ['life', 'wisdom', 'control']
    },
    {
        pt: "Lembre-se de que muito pouco é necessário para ter uma vida feliz.",
        en: "Remember that very little is needed to make a happy life.",
        es: "Recuerda que se necesita muy poco para tener una vida feliz.",
        author: "marcusAurelius",
        tags: ['happiness', 'minimalism', 'simplicity']
    },
    {
        pt: "A única riqueza que você manterá para sempre é a riqueza que você doou.",
        en: "The only wealth which you will keep forever is the wealth you have given away.",
        es: "La única riqueza que conservarás para siempre es la riqueza que has regalado.",
        author: "marcusAurelius",
        tags: ['wealth', 'community', 'virtue']
    },
    {
        pt: "Passe por este breve trecho de tempo em harmonia com a natureza, e chegue ao seu descanso com boa graça, como uma azeitona cai quando está madura.",
        en: "Pass through this brief patch of time in harmony with nature, and come to your rest with a good grace, as an olive falls when it is ripe.",
        es: "Pasa por este breve lapso de tiempo en armonía con la naturaleza, y llega a tu descanso con buena gracia, como cae una aceituna cuando está madura.",
        author: "marcusAurelius",
        tags: ['nature', 'death', 'acceptance', 'peace']
    },
    {
        pt: "Faça o que fizer ou diga o que disser, devo ser esmeralda e manter minha cor.",
        en: "Whatever anyone does or says, I must be emerald and keep my colour.",
        es: "Haga lo que haga o diga lo que diga cualquiera, debo ser esmeralda y mantener mi color.",
        author: "marcusAurelius",
        tags: ['integrity', 'consistency', 'character']
    },
    {
        pt: "Tudo o que acontece, acontece como deveria, e se você observar com atenção, verá que é assim.",
        en: "Everything that happens happens as it should, and if you observe carefully, you will find this to be so.",
        es: "Todo lo que sucede, sucede como debería, y si observas con atención, verás que es así.",
        author: "marcusAurelius",
        tags: ['fate', 'reality', 'acceptance']
    },
    {
        pt: "Nunca considere como vantagem algo que faça você quebrar sua palavra ou perder seu autorespeito.",
        en: "Never esteem anything as of advantage to you that will make you break your word or lose your self-respect.",
        es: "Nunca estimes como ventaja algo que te haga romper tu palabra o perder tu respeto por ti mismo.",
        author: "marcusAurelius",
        tags: ['integrity', 'honor', 'virtue']
    },
    {
        pt: "Aqui está uma regra para lembrar no futuro, quando algo te tentar a sentir amargura: não 'Isso é infortúnio', mas 'Suportar isso dignamente é boa sorte'.",
        en: "Here is a rule to remember in future, when anything tempts you to feel bitter: not 'This is misfortune,' but 'To bear this worthily is good fortune.'",
        es: "Aquí hay una regla para recordar en el futuro, cuando algo te tiente a sentir amargura: no 'Esto es desgracia', sino 'Soportar esto dignamente es buena suerte'.",
        author: "marcusAurelius",
        tags: ['resilience', 'perception', 'suffering']
    },
    {
        pt: "Pergunte a si mesmo a cada momento: 'Isso é necessário?'",
        en: "Ask yourself at every moment, 'Is this necessary?'",
        es: "Pregúntate a ti mismo en cada momento: '¿Es esto necesario?'",
        author: "marcusAurelius",
        tags: ['focus', 'essentialism', 'simplicity']
    },
    {
        pt: "Se alguém for capaz de me mostrar que o que penso ou faço não é correto, mudarei com prazer, pois busco a verdade, pela qual ninguém jamais foi prejudicado.",
        en: "If someone is able to show me that what I think or do is not right, I will happily change, for I seek the truth, by which no one was ever truly harmed.",
        es: "Si alguien es capaz de mostrarme que lo que pienso o hago no es correcto, cambiaré con gusto, pues busco la verdad, por la cual nadie ha sido jamás perjudicado.",
        author: "marcusAurelius",
        tags: ['truth', 'humility', 'growth', 'learning']
    },

    // --- SÊNECA (EXPANDED) ---
    {
        pt: "Sofremos mais na imaginação do que na realidade.",
        en: "We suffer more often in imagination than in reality.",
        es: "Sufrimos más a menudo en la imaginación que en la realidad.",
        author: "seneca",
        tags: ['control', 'resilience', 'reality', 'anxiety']
    },
    {
        pt: "Não é que tenhamos pouco tempo, mas sim que desperdiçamos muito.",
        en: "It is not that we have so little time but that we lose so much.",
        es: "No es que tengamos poco tiempo, sino que perdemos mucho.",
        author: "seneca",
        tags: ['time', 'action']
    },
    {
        pt: "Enquanto esperamos pela vida, a vida passa.",
        en: "While we are postponing, life speeds by.",
        es: "Mientras posponemos, la vida pasa.",
        author: "seneca",
        tags: ['action', 'time', 'morning']
    },
    {
        pt: "Sorte é o que acontece quando a preparação encontra a oportunidade.",
        en: "Luck is what happens when preparation meets opportunity.",
        es: "La suerte es lo que sucede cuando la preparación se encuentra con la oportunidad.",
        author: "seneca",
        tags: ['discipline', 'action', 'focus']
    },
    {
        pt: "Se um homem não sabe a que porto se dirige, nenhum vento lhe é favorável.",
        en: "If a man knows not to which port he sails, no wind is favorable.",
        es: "Si un hombre no sabe a qué puerto se dirige, ningún viento le es favorable.",
        author: "seneca",
        tags: ['learning', 'discipline', 'focus']
    },
    {
        pt: "Dificuldades fortalecem a mente, assim como o trabalho o faz com o corpo.",
        en: "Difficulties strengthen the mind, as labor does the body.",
        es: "Las dificultades fortalecen la mente, igual que el trabajo lo hace con el cuerpo.",
        author: "seneca",
        tags: ['resilience', 'discipline', 'suffering']
    },
    {
        pt: "A verdadeira felicidade é desfrutar o presente, sem dependência ansiosa do futuro.",
        en: "True happiness is to enjoy the present, without anxious dependence upon the future.",
        es: "La verdadera felicidad es disfrutar el presente, sin dependencia ansiosa del futuro.",
        author: "seneca",
        tags: ['gratitude', 'time', 'anxiety']
    },
    {
        pt: "Começar a viver é a coisa mais séria que existe.",
        en: "To begin living is the most serious thing there is.",
        es: "Comenzar a vivir es lo más serio que existe.",
        author: "seneca",
        tags: ['action', 'time']
    },
    {
        pt: "Nada, na minha opinião, é uma prova melhor de uma mente bem ordenada do que a capacidade de parar exatamente onde está e passar algum tempo em sua própria companhia.",
        en: "Nothing, to my way of thinking, is a better proof of a well-ordered mind than a man’s ability to stop just where he is and pass some time in his own company.",
        es: "Nada, en mi opinión, es una mejor prueba de una mente bien ordenada que la capacidad de detenerse exactamente donde está y pasar algún tiempo en su propia compañía.",
        author: "seneca",
        tags: ['control', 'nature', 'focus', 'reflection', 'rest']
    },
    {
        pt: "Muitas vezes, o homem que mais viveu não é aquele que viveu mais tempo, mas aquele que sentiu mais a vida.",
        en: "Often the man who has lived the most is not the one who has lived the longest, but the one who has felt life the most.",
        es: "A menudo, el hombre que más ha vivido no es el que ha vivido más tiempo, sino el que más ha sentido la vida.",
        author: "seneca",
        tags: ['time', 'gratitude']
    },
    {
        pt: "Apressa-te a viver bem e pensa que cada dia é, por si só, uma vida.",
        en: "Begin at once to live, and count each separate day as a separate life.",
        es: "Apresúrate a vivir bien y piensa que cada día es, por sí solo, una vida.",
        author: "seneca",
        tags: ['time', 'action', 'evening']
    },
    {
        pt: "Não existe vento favorável para o marinheiro que não sabe aonde ir.",
        en: "If one does not know to which port one is sailing, no wind is favorable.",
        es: "No hay viento favorable para el marinero que no sabe a dónde ir.",
        author: "seneca",
        tags: ['discipline', 'control', 'focus']
    },
    {
        pt: "O homem que sofre antes que seja necessário, sofre mais do que o necessário.",
        en: "He who suffers before it is necessary, suffers more than is necessary.",
        es: "El que sufre antes de que sea necesario, sufre más de lo necesario.",
        author: "seneca",
        tags: ['suffering', 'control', 'anxiety']
    },
    {
        pt: "Nós somos mais assustados do que machucados.",
        en: "We are more often frightened than hurt.",
        es: "A menudo estamos más asustados que heridos.",
        author: "seneca",
        tags: ['reality', 'resilience', 'anxiety']
    },
    {
        pt: "A vida é longa se você souber como usá-la.",
        en: "Life is long if you know how to use it.",
        es: "La vida es larga si sabes cómo usarla.",
        author: "seneca",
        tags: ['time', 'learning']
    },
    {
        pt: "Associe-se com pessoas que provavelmente irão melhorá-lo.",
        en: "Associate with people who are likely to improve you.",
        es: "Asóciate con personas que probablemente te mejoren.",
        author: "seneca",
        tags: ['learning', 'nature', 'community']
    },
    {
        pt: "Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.",
        en: "It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult.",
        es: "No es porque las cosas son difíciles que no nos atrevemos; es porque no nos atrevemos que son difíciles.",
        author: "seneca",
        tags: ['action', 'resilience']
    },
    {
        pt: "A raiva, se não contida, é frequentemente mais prejudicial para nós do que a lesão que a provoca.",
        en: "Anger, if not restrained, is frequently more hurtful to us than the injury that provokes it.",
        es: "La ira, si no se reprime, es frecuentemente más perjudicial para nosotros que la injuria que la provoca.",
        author: "seneca",
        tags: ['temperance', 'control']
    },
    {
        pt: "Uma joia não pode ser polida sem atrito, nem um homem aperfeiçoado sem provações.",
        en: "A gem cannot be polished without friction, nor a man perfected without trials.",
        es: "Una gema no se puede pulir sin fricción, ni un hombre perfeccionarse sin pruebas.",
        author: "seneca",
        tags: ['resilience', 'suffering']
    },
    {
        pt: "Onde quer que haja um ser humano, há uma oportunidade para a bondade.",
        en: "Wherever there is a human being, there is an opportunity for a kindness.",
        es: "Dondequiera que haya un ser humano, hay una oportunidad para la bondad.",
        author: "seneca",
        tags: ['nature', 'humility', 'community']
    },
    {
        pt: "A vida sem um propósito é vã.",
        en: "Life without a design is erratic.",
        es: "La vida sin un diseño es errática.",
        author: "seneca",
        tags: ['discipline', 'reality', 'focus']
    },
    {
        pt: "Você deve viver para o outro, se quiser viver para si mesmo.",
        en: "You must live for another if you wish to live for yourself.",
        es: "Debes vivir para otro si deseas vivir para ti mismo.",
        author: "seneca",
        tags: ['nature', 'humility', 'community']
    },
    {
        pt: "A fidelidade comprada com dinheiro, pode ser destruída pelo dinheiro.",
        en: "Loyalty purchased with money, money can destroy.",
        es: "La lealtad comprada con dinero, puede ser destruida por el dinero.",
        author: "seneca",
        tags: ['virtue', 'reality']
    },
    {
        pt: "Cada dia é uma nova vida. Sinta cada momento.",
        en: "Every day is a new life. Feel every moment.",
        es: "Cada día es una nueva vida. Siente cada momento.",
        author: "seneca",
        tags: ['time', 'gratitude', 'nature']
    },
    {
        pt: "O homem mais poderoso é aquele que tem poder sobre si mesmo.",
        en: "Most powerful is he who has himself in his own power.",
        es: "El hombre más poderoso es aquel que tiene poder sobre sí mismo.",
        author: "seneca",
        tags: ['control', 'discipline']
    },
    {
        pt: "É preciso dizer a verdade apenas a quem está disposto a ouvi-la.",
        en: "Truth should be told only to those who are willing to listen.",
        es: "La verdad debe decirse solo a aquellos que están dispuestos a escucharla.",
        author: "seneca",
        tags: ['wisdom', 'community']
    },
    {
        pt: "Quando fores para a cama, repassa os teus atos. O que fizeste de errado? O que fizeste de bom? O que deixaste de fazer?",
        en: "When the light has been removed and my wife has fallen silent... I examine my entire day and go back over what I've done and said, hiding nothing from myself.",
        es: "Cuando se ha retirado la luz y mi esposa ha callado... examino todo mi día y repaso lo que he hecho y dicho, sin ocultarme nada.",
        author: "seneca",
        tags: ['reflection', 'evening', 'discipline']
    },
    {
        pt: "Estar em todo lugar é estar em lugar nenhum.",
        en: "To be everywhere is to be nowhere.",
        es: "Estar en todas partes es no estar en ninguna parte.",
        author: "seneca",
        tags: ['focus', 'action', 'consistency']
    },
    {
        pt: "A mente que está ansiosa pelo futuro é miserável.",
        en: "The mind that is anxious about future events is miserable.",
        es: "La mente que está ansiosa por los eventos futuros es miserable.",
        author: "seneca",
        tags: ['anxiety', 'time', 'presence']
    },
    {
        pt: "Nenhum homem foi sábio por acaso.",
        en: "No man was ever wise by chance.",
        es: "Ningún hombre fue sabio por casualidad.",
        author: "seneca",
        tags: ['discipline', 'learning', 'action']
    },
    {
        pt: "Às vezes, até viver é um ato de coragem.",
        en: "Sometimes even to live is an act of courage.",
        es: "A veces, incluso vivir es un acto de coraje.",
        author: "seneca",
        tags: ['resilience', 'suffering']
    },
    {
        pt: "Nós aprendemos não para a escola, mas para a vida.",
        en: "We learn not for school but for life.",
        es: "Aprendemos no para la escuela, sino para la vida.",
        author: "seneca",
        tags: ['learning', 'wisdom']
    },
    {
        pt: "Não é pobre quem tem pouco, mas quem cobiça mais.",
        en: "It is not the man who has too little, but the man who craves more, that is poor.",
        es: "No es pobre el que tiene poco, sino el que mucho desea.",
        author: "seneca",
        tags: ['temperance', 'wealth', 'reality']
    },
    {
        pt: "Apresse-se e viva.",
        en: "Hurry up and live.",
        es: "Apresúrate a vivir.",
        author: "seneca",
        tags: ['time', 'action']
    },
    {
        pt: "O ouro é provado pelo fogo, os bravos pela adversidade.",
        en: "Gold is tried by fire, brave men by adversity.",
        es: "El acero se prueba con fuego, los hombres valientes con adversidad.",
        author: "seneca",
        tags: ['resilience', 'suffering']
    },
    {
        pt: "Você age como mortal em tudo que teme, e como imortal em tudo que deseja.",
        en: "You act like mortals in all that you fear, and like immortals in all that you desire.",
        es: "Actúas como mortal en todo lo que temes, y como inmortal en todo lo que deseas.",
        author: "seneca",
        tags: ['time', 'anxiety', 'reality']
    },
    {
        pt: "O maior remédio para a raiva é o adiamento.",
        en: "The greatest remedy for anger is delay.",
        es: "El mejor remedio para la ira es la demora.",
        author: "seneca",
        tags: ['control', 'temperance', 'anxiety']
    },
    {
        pt: "A vida, se bem vivida, é longa.",
        en: "Life, if well spent, is long.",
        es: "La vida, si se vive bien, es larga.",
        author: "seneca",
        tags: ['time', 'virtue']
    },
    {
        pt: "Aquele que é bravo é livre.",
        en: "He who is brave is free.",
        es: "Aquel que es valiente es libre.",
        author: "seneca",
        tags: ['action', 'control', 'freedom']
    },
    {
        pt: "Querer estar bem é uma parte de estar bem.",
        en: "To wish to be well is a part of becoming well.",
        es: "Querer estar bien es parte de estar bien.",
        author: "seneca",
        tags: ['action', 'perspective']
    },
    {
        pt: "Desfrute dos prazeres presentes de forma a não prejudicar os futuros.",
        en: "Enjoy present pleasures in such a way as not to injure future ones.",
        es: "Disfruta de los placeres presentes de manera que no perjudiques los futuros.",
        author: "seneca",
        tags: ['temperance', 'discipline']
    },
    {
        pt: "Importa a qualidade, não a quantidade.",
        en: "It is quality rather than quantity that matters.",
        es: "Importa la calidad, no la cantidad.",
        author: "seneca",
        tags: ['wisdom', 'focus', 'virtue']
    },
    {
        pt: "O silêncio é uma lição aprendida através dos muitos sofrimentos da vida.",
        en: "Silence is a lesson learned through life's many sufferings.",
        es: "El silencio es una lección aprendida a través de los muchos sufrimientos de la vida.",
        author: "seneca",
        tags: ['suffering', 'wisdom', 'resilience']
    },
    {
        pt: "Seja silencioso sobre os serviços que prestou, mas fale sobre os que recebeu.",
        en: "Be silent as to services you have rendered, but speak of those you have received.",
        es: "Guarda silencio sobre los servicios que has prestado, pero habla de los que has recibido.",
        author: "seneca",
        tags: ['humility', 'gratitude']
    },
    {
        pt: "Um presente não consiste no que é dado, mas na intenção do doador.",
        en: "A gift consists not in what is done or given, but in the intention of the giver or doer.",
        es: "Un regalo no consiste en lo que se da o hace, sino en la intención del que da.",
        author: "seneca",
        tags: ['virtue', 'gratitude']
    },
    {
        pt: "Nada é mais honroso do que um coração grato.",
        en: "Nothing is more honorable than a grateful heart.",
        es: "Nada es más honorable que un corazón agradecido.",
        author: "seneca",
        tags: ['gratitude', 'virtue']
    },
    {
        pt: "Não há prazer na posse de nada valioso a menos que se tenha alguém com quem compartilhar.",
        en: "There is no enjoying the possession of anything valuable unless one has someone to share it with.",
        es: "No hay placer en la posesión de nada valioso a menos que se tenga a alguien con quien compartirlo.",
        author: "seneca",
        tags: ['community', 'nature']
    },
    {
        pt: "Treinemos nossa mente para desejar o que a situação exige.",
        en: "Let us train our minds to desire what the situation demands.",
        es: "Entrenemos nuestra mente para desear lo que la situación exige.",
        author: "seneca",
        tags: ['control', 'resilience', 'reality']
    },
    {
        pt: "A embriaguez não é nada além de loucura voluntária.",
        en: "Drunkenness is nothing but voluntary madness.",
        es: "La embriaguez no es más que locura voluntaria.",
        author: "seneca",
        tags: ['temperance', 'control']
    },
    {
        pt: "Uma espada nunca mata ninguém; é uma ferramenta na mão do assassino.",
        en: "A sword never kills anybody; it is a tool in the killer's hand.",
        es: "Una espada nunca mata a nadie; es una herramienta en la mano del asesino.",
        author: "seneca",
        tags: ['responsibility', 'control']
    },
    {
        pt: "É difícil levar as pessoas à bondade com lições, mas é fácil fazê-lo pelo exemplo.",
        en: "It is difficult to bring people to goodness with lessons, but it is easy to do so by example.",
        es: "Es difícil llevar a las personas a la bondad con lecciones, pero es fácil hacerlo con el ejemplo.",
        author: "seneca",
        tags: ['action', 'leadership', 'learning']
    },
    {
        pt: "É uma estrada áspera que leva às alturas da grandeza.",
        en: "It is a rough road that leads to the heights of greatness.",
        es: "Es un camino áspero el que lleva a las alturas de la grandeza.",
        author: "seneca",
        tags: ['resilience', 'suffering']
    },
    {
        pt: "Só o tempo pode curar o que a razão não pode.",
        en: "Only time can heal what reason cannot.",
        es: "Solo el tiempo puede curar lo que la razón no puede.",
        author: "seneca",
        tags: ['time', 'reality']
    },
    {
        pt: "Aquele que teme a morte nunca fará nada digno de um homem vivo.",
        en: "He who fears death will never do anything worthy of a man who is alive.",
        es: "El que teme a la muerte nunca hará nada digno de un hombre vivo.",
        author: "seneca",
        tags: ['death', 'action', 'courage']
    },
    {
        pt: "Muitas vezes erramos por medo de errar.",
        en: "We often fail for fear of failing.",
        es: "A menudo fallamos por miedo a fallar.",
        author: "seneca",
        tags: ['anxiety', 'action']
    },
    {
        pt: "Ninguém pode usar uma máscara por muito tempo.",
        en: "No man can wear a mask for very long.",
        es: "Nadie puede llevar una máscara por mucho tiempo.",
        author: "seneca",
        tags: ['truth', 'reality', 'nature']
    },
    {
        pt: "Viver significa lutar.",
        en: "To live is to fight.",
        es: "Vivir es luchar.",
        author: "seneca",
        tags: ['action', 'resilience']
    },
    {
        pt: "O que é o limite da riqueza? Primeiro, ter o necessário; segundo, ter o suficiente.",
        en: "What is the proper limit to wealth? It is, first, to have what is necessary, and, second, to have what is enough.",
        es: "¿Cuál es el límite adecuado de la riqueza? Es, primero, tener lo necesario, y segundo, tener lo suficiente.",
        author: "seneca",
        tags: ['temperance', 'wealth']
    },
    {
        pt: "Onde há medo, a felicidade falha.",
        en: "Where fear is, happiness is not.",
        es: "Donde hay miedo, la felicidad falla.",
        author: "seneca",
        tags: ['anxiety', 'happiness']
    },
    {
        pt: "A melhor cura para a raiva é a demora.",
        en: "The greatest remedy for anger is delay.",
        es: "El mejor remedio para la ira es la demora.",
        author: "seneca",
        tags: ['anxiety', 'control', 'temperance']
    },
    {
        pt: "Nenhum homem é mais infeliz do que aquele que nunca enfrentou a adversidade. Pois ele não tem permissão para provar a si mesmo.",
        en: "No man is more unhappy than he who never faces adversity. For he is not permitted to prove himself.",
        es: "Ningún hombre es más infeliz que aquel que nunca ha enfrentado la adversidad. Porque no se le permite probarse a sí mismo.",
        author: "seneca",
        tags: ['resilience', 'suffering', 'learning']
    },
    {
        pt: "Devemos ir à procura da verdade, não de quem a diz.",
        en: "We should look for the truth, not for who says it.",
        es: "Debemos buscar la verdad, no quién la dice.",
        author: "seneca",
        tags: ['truth', 'wisdom']
    },
    {
        pt: "É parte da cura o desejo de ser curado.",
        en: "It is part of the cure to wish to be cured.",
        es: "Es parte de la cura desear ser curado.",
        author: "seneca",
        tags: ['action', 'learning', 'nature']
    },
    {
        pt: "Não é o homem que tem muito pouco, mas o homem que deseja mais, que é pobre.",
        en: "It is not the man who has too little, but the man who craves more, that is poor.",
        es: "No es el hombre que tiene muy poco, sino el hombre que desea más, el que es pobre.",
        author: "seneca",
        tags: ['wealth', 'temperance', 'gratitude']
    },
    {
        pt: "A vida é como uma peça de teatro: não importa quão longa seja, mas sim quão bem foi representada.",
        en: "Life is like a play: it's not the length, but the excellence of the acting that matters.",
        es: "La vida es como una obra de teatro: no importa cuánto dure, sino lo bien que se haya representado.",
        author: "seneca",
        tags: ['time', 'virtue', 'reality']
    },
    {
        pt: "O destino conduz quem consente e arrasta quem resiste.",
        en: "Fate leads the willing and drags along the reluctant.",
        es: "El destino conduce a quien consiente y arrastra a quien resiste.",
        author: "seneca",
        tags: ['fate', 'acceptance', 'resilience']
    },
    {
        pt: "Se você quer ser amado, ame.",
        en: "If you wish to be loved, love.",
        es: "Si quieres ser amado, ama.",
        author: "seneca",
        tags: ['community', 'action']
    },
    {
        pt: "A ociosidade é o túmulo de um homem vivo.",
        en: "Idleness is the burial of a living man.",
        es: "La ociosidad es la tumba de un hombre vivo.",
        author: "seneca",
        tags: ['action', 'discipline', 'time']
    },
    {
        pt: "Todo o futuro reside na incerteza: viva imediatamente.",
        en: "The whole future lies in uncertainty: live immediately.",
        es: "Todo el futuro reside en la incertidumbre: vive inmediatamente.",
        author: "seneca",
        tags: ['time', 'action', 'presence']
    },
    // --- NEW SENECA QUOTES (DOUBLING) ---
    {
        pt: "O que pode acontecer a qualquer momento pode acontecer hoje.",
        en: "Whatever can happen at any time can happen today.",
        es: "Lo que puede suceder en cualquier momento puede suceder hoy.",
        author: "seneca",
        tags: ['anxiety', 'preparation', 'time']
    },
    {
        pt: "É uma negação da justiça não estender a mão para os caídos.",
        en: "It is a denial of justice not to stretch out a helping hand to the fallen.",
        es: "Es una negación de la justicia no tender una mano amiga a los caídos.",
        author: "seneca",
        tags: ['community', 'virtue', 'justice']
    },
    {
        pt: "Digamos o que sentimos e sintamos o que dizemos; que a fala se harmonize com a vida.",
        en: "Let us say what we feel, and feel what we say; let speech harmonize with life.",
        es: "Digamos lo que sentimos y sintamos lo que decimos; que el habla armonice con la vida.",
        author: "seneca",
        tags: ['integrity', 'action', 'truth']
    },
    {
        pt: "Até que tenhamos começado a viver sem elas, não percebemos quão desnecessárias muitas coisas são.",
        en: "Until we have begun to go without them, we fail to realize how unnecessary many things are.",
        es: "Hasta que hemos empezado a prescindir de ellas, no nos damos cuenta de lo innecesarias que son muchas cosas.",
        author: "seneca",
        tags: ['temperance', 'minimalism', 'wealth']
    },
    {
        pt: "A expectativa é o maior impedimento para viver. Na antecipação do amanhã, perde-se o hoje.",
        en: "Expectation is the greatest impediment to living. In anticipation of tomorrow, it loses today.",
        es: "La expectativa es el mayor impedimento para vivir. En previsión del mañana, pierde el hoy.",
        author: "seneca",
        tags: ['time', 'anxiety', 'presence']
    },
    {
        pt: "Eles perdem o dia na expectativa da noite, e a noite no medo da madrugada.",
        en: "They lose the day in expectation of the night, and the night in fear of the dawn.",
        es: "Pierden el día esperando la noche, y la noche temiendo el amanecer.",
        author: "seneca",
        tags: ['anxiety', 'time', 'evening']
    },
    {
        pt: "Se você viver em harmonia com a natureza, nunca será pobre; se viver de acordo com o que os outros pensam, nunca será rico.",
        en: "If you live in harmony with nature you will never be poor; if you live according to what others think, you will never be rich.",
        es: "Si vives en armonía con la naturaleza nunca serás pobre; si vives de acuerdo con lo que piensan los demás, nunca serás rico.",
        author: "seneca",
        tags: ['wealth', 'nature', 'freedom']
    },
    {
        pt: "A verdadeira glória consiste em fazer o que merece ser escrito; em escrever o que merece ser lido.",
        en: "True glory consists in doing what deserves to be written; in writing what deserves to be read.",
        es: "La verdadera gloria consiste en hacer lo que merece ser escrito; en escribir lo que merece ser leído.",
        author: "seneca",
        tags: ['action', 'purpose', 'legacy']
    },
    {
        pt: "Aquele que faz o bem ao outro faz o bem também a si mesmo.",
        en: "He who does good to another does good also to himself.",
        es: "El que hace bien a otro se hace bien también a sí mismo.",
        author: "seneca",
        tags: ['community', 'virtue', 'happiness']
    },
    {
        pt: "Ser sempre afortunado e passar pela vida com uma alma que nunca conheceu a tristeza é ignorar metade da natureza.",
        en: "To be always fortunate, and to pass through life with a soul that has never known sorrow, is to be ignorant of one half of nature.",
        es: "Ser siempre afortunado y pasar por la vida con un alma que nunca ha conocido la tristeza es ignorar la mitad de la naturaleza.",
        author: "seneca",
        tags: ['resilience', 'learning', 'nature']
    },
    {
        pt: "Considere o resultado de todas as suas ações e você nunca será pego desprevenido.",
        en: "Consider the result of all your actions, and you will never be caught unprepared.",
        es: "Considere el resultado de todas sus acciones y nunca lo tomarán desprevenido.",
        author: "seneca",
        tags: ['preparation', 'prudence', 'action']
    },
    {
        pt: "Uma briga é rapidamente resolvida quando abandonada por uma das partes; não há batalha a menos que haja dois.",
        en: "A quarrel is quickly settled when deserted by the one party; there is no battle unless there be two.",
        es: "Una pelea se resuelve rápidamente cuando es abandonada por una de las partes; no hay batalla a menos que haya dos.",
        author: "seneca",
        tags: ['community', 'temperance', 'peace']
    },
    {
        pt: "Aquele que pede timidamente convida a uma negação.",
        en: "He who asks timidly courts a denial.",
        es: "El que pide tímidamente corteja una negativa.",
        author: "seneca",
        tags: ['action', 'courage', 'confidence']
    },
    {
        pt: "Enquanto ensinamos, aprendemos.",
        en: "While we teach, we learn.",
        es: "Mientras enseñamos, aprendemos.",
        author: "seneca",
        tags: ['learning', 'community', 'growth']
    },
    {
        pt: "O que realmente arruína nosso caráter é o fato de que nenhum de nós olha para trás em sua vida.",
        en: "What really ruins our character is the fact that none of us looks back over his life.",
        es: "Lo que realmente arruina nuestro carácter es el hecho de que ninguno de nosotros mira hacia atrás en su vida.",
        author: "seneca",
        tags: ['reflection', 'growth', 'character']
    },
    {
        pt: "Somos membros de um grande corpo. A natureza plantou em nós um amor mútuo.",
        en: "We are members of one great body. Nature planted in us a mutual love.",
        es: "Somos miembros de un gran cuerpo. La naturaleza plantó en nosotros un amor mutuo.",
        author: "seneca",
        tags: ['community', 'nature', 'love']
    },
    {
        pt: "A ignorância é a causa do medo.",
        en: "Ignorance is the cause of fear.",
        es: "La ignorancia es la causa del miedo.",
        author: "seneca",
        tags: ['anxiety', 'learning', 'fear']
    },
    {
        pt: "Recolha-se em si mesmo, tanto quanto puder.",
        en: "Withdraw into yourself, as far as you can.",
        es: "Retírate dentro de ti mismo, tanto como puedas.",
        author: "seneca",
        tags: ['focus', 'solitude', 'reflection']
    },
    {
        pt: "Nenhum homem é bom por acaso. A virtude é algo que deve ser aprendido.",
        en: "No man is good by chance. Virtue is something which must be learned.",
        es: "Ningún hombre es bueno por casualidad. La virtud es algo que debe aprenderse.",
        author: "seneca",
        tags: ['virtue', 'discipline', 'learning']
    },
    {
        pt: "Somente o homem justo desfruta de paz de espírito.",
        en: "Only the just man enjoys peace of mind.",
        es: "Sólo el hombre justo disfruta de la paz mental.",
        author: "seneca",
        tags: ['peace', 'virtue', 'anxiety']
    },
    {
        pt: "Dedique-se às verdadeiras riquezas; é vergonhoso depender de prata e ouro para uma vida feliz.",
        en: "Apply thyself to the true riches; it is shameful to depend for a happy life on silver and gold.",
        es: "Aplícate a las verdaderas riquezas; es vergonzoso depender de la plata y el oro para una vida feliz.",
        author: "seneca",
        tags: ['wealth', 'virtue', 'happiness']
    },
    {
        pt: "Quem poupa os maus fere os bons.",
        en: "He who spares the wicked injures the good.",
        es: "El que perdona a los malvados hiere a los buenos.",
        author: "seneca",
        tags: ['justice', 'action', 'responsibility']
    },
    {
        pt: "Pequenas dores são loquazes, mas as grandes são mudas.",
        en: "Light griefs are loquacious, but the great are dumb.",
        es: "Los dolores leves son locuaces, pero los grandes son mudos.",
        author: "seneca",
        tags: ['suffering', 'resilience', 'silence']
    },
    {
        pt: "Todo novo começo vem do fim de algum outro começo.",
        en: "Every new beginning comes from some other beginning's end.",
        es: "Todo nuevo comienzo viene del final de algún otro comienzo.",
        author: "seneca",
        tags: ['change', 'resilience', 'time']
    },
    {
        pt: "Nenhum mal existe sem sua compensação.",
        en: "No evil is without its compensation.",
        es: "Ningún mal existe sin su compensación.",
        author: "seneca",
        tags: ['perception', 'optimism', 'resilience']
    },
    {
        pt: "A restrição é a mãe da invenção.",
        en: "Constraint is the mother of invention.",
        es: "La restricción es la madre de la invención.",
        author: "seneca",
        tags: ['creativity', 'resilience', 'growth']
    },
    {
        pt: "Apegue-se aos seus entusiasmos juvenis — você poderá usá-los melhor quando for mais velho.",
        en: "Hang on to your youthful enthusiasms — you’ll be able to use them better when you’re older.",
        es: "Aferrate a tus entusiasmos juveniles: podrás usarlos mejor cuando seas mayor.",
        author: "seneca",
        tags: ['growth', 'time', 'passion']
    },

    // --- EPICTETO (EXPANDED) ---
    {
        pt: "Não é o que acontece com você, mas como você reage a isso que importa.",
        en: "It's not what happens to you, but how you react to it that matters.",
        es: "No es lo que te sucede, sino cómo reaccionas a ello lo que importa.",
        author: "epictetus",
        tags: ['control', 'resilience', 'perception']
    },
    {
        pt: "Primeiro diga a si mesmo o que você seria; e então faça o que tem que fazer.",
        en: "First say to yourself what you would be; and then do what you have to do.",
        es: "Primero dite a ti mismo lo que serías; y luego haz lo que tienes que hacer.",
        author: "epictetus",
        tags: ['action', 'discipline', 'reality', 'consistency']
    },
    {
        pt: "A riqueza não consiste em ter grandes posses, mas em ter poucas necessidades.",
        en: "Wealth consists not in having great possessions, but in having few wants.",
        es: "La riqueza no consiste en tener grandes posesiones, sino en tener pocas necesidades.",
        author: "epictetus",
        tags: ['temperance', 'gratitude']
    },
    {
        pt: "Nenhum homem é livre se não for mestre de si mesmo.",
        en: "No man is free who is not master of himself.",
        es: "Ningún hombre es libre si no es dueño de sí mismo.",
        author: "epictetus",
        tags: ['discipline', 'control']
    },
    {
        pt: "Se você quer melhorar, contente-se em ser considerado tolo.",
        en: "If you want to improve, be content to be thought foolish.",
        es: "Si quieres mejorar, conténtate con ser considerado tonto.",
        author: "epictetus",
        tags: ['learning', 'humility']
    },
    {
        pt: "Não busque que as coisas aconteçam como você deseja, mas deseje que elas aconteçam como acontecem.",
        en: "Do not seek to have events happen as you want them to, but instead want them to happen as they do happen.",
        es: "No busques que los eventos sucedan como deseas, sino desea que sucedan como suceden.",
        author: "epictetus",
        tags: ['control', 'reality', 'nature']
    },
    {
        pt: "Quanto maior a dificuldade, maior a glória em superá-la.",
        en: "The greater the difficulty, the more glory in surmounting it.",
        es: "Cuanto mayor es la dificultad, mayor es la gloria en superarla.",
        author: "epictetus",
        tags: ['resilience', 'discipline', 'suffering']
    },
    {
        pt: "O que quer que você torne habitual, pratique-o.",
        en: "Whatever you would make habitual, practice it.",
        es: "Cualquier cosa que quieras hacer habitual, practícala.",
        author: "epictetus",
        tags: ['action', 'discipline', 'consistency']
    },
    {
        pt: "Exija o melhor de si mesmo.",
        en: "Demand the best from yourself.",
        es: "Exígete lo mejor a ti mismo.",
        author: "epictetus",
        tags: ['discipline', 'action', 'virtue']
    },
    {
        pt: "É impossível para um homem aprender o que ele acha que já sabe.",
        en: "It is impossible for a man to learn what he thinks he already knows.",
        es: "Es imposible que un hombre aprenda lo que cree que ya sabe.",
        author: "epictetus",
        tags: ['learning', 'humility']
    },
    {
        pt: "A liberdade é o único objetivo digno na vida. É conquistada desconsiderando coisas que estão além do nosso controle.",
        en: "Freedom is the only worthy goal in life. It is won by disregarding things that lie beyond our control.",
        es: "La libertad es el único objetivo digno en la vida. Se gana ignorando las cosas que están más allá de nuestro control.",
        author: "epictetus",
        tags: ['control', 'discipline']
    },
    {
        pt: "Não explique sua filosofia. Incorpore-a.",
        en: "Don't explain your philosophy. Embody it.",
        es: "No expliques tu filosofía. Encárnala.",
        author: "epictetus",
        tags: ['action', 'discipline']
    },
    {
        pt: "Se você quer ser um escritor, escreva.",
        en: "If you wish to be a writer, write.",
        es: "Si quieres ser escritor, escribe.",
        author: "epictetus",
        tags: ['action', 'discipline', 'consistency']
    },
    {
        pt: "A felicidade é a serenidade da mente.",
        en: "Happiness is serenity of the mind.",
        es: "La felicidad es la serenidad de la mente.",
        author: "epictetus",
        tags: ['nature', 'control']
    },
    {
        pt: "As pessoas não são perturbadas pelas coisas, mas pela visão que têm delas.",
        en: "Men are disturbed not by things, but by the view which they take of them.",
        es: "Los hombres no se perturban por las cosas, sino por la visión que tienen de ellas.",
        author: "epictetus",
        tags: ['control', 'reality', 'perception']
    },
    {
        pt: "Saiba primeiro quem você é, e depois adorne-se de acordo.",
        en: "Know, first, who you are, and then adorn yourself accordingly.",
        es: "Conoce primero quién eres, y luego adórnate en consecuencia.",
        author: "epictetus",
        tags: ['learning', 'nature']
    },
    {
        pt: "Qualquer pessoa capaz de te irritar torna-se teu mestre.",
        en: "Any person capable of angering you becomes your master.",
        es: "Cualquier persona capaz de enojarte se convierte en tu amo.",
        author: "epictetus",
        tags: ['control', 'temperance']
    },
    {
        pt: "Só há um caminho para a felicidade e é parar de se preocupar com coisas que estão além do poder da nossa vontade.",
        en: "There is only one way to happiness and that is to cease worrying about things which are beyond the power of our will.",
        es: "Solo hay un camino hacia la felicidad y es dejar de preocuparse por las cosas que están más allá del poder de nuestra voluntad.",
        author: "epictetus",
        tags: ['control', 'gratitude', 'anxiety']
    },
    {
        pt: "Se o mal é dito sobre ti, e se é verdade, corrige-te; se é mentira, ria disso.",
        en: "If evil be said of thee, and if it be true, correct thyself; if it be a lie, laugh at it.",
        es: "Si se dice mal de ti, y si es verdad, corrígete; si es mentira, ríete de ello.",
        author: "epictetus",
        tags: ['humility', 'learning']
    },
    {
        pt: "Não tente parecer sábio aos olhos dos outros.",
        en: "Do not try to seem wise to others.",
        es: "No intentes parecer sabio ante los demás.",
        author: "epictetus",
        tags: ['humility', 'discipline']
    },
    {
        pt: "Cuide deste momento. Mergulhe em suas particularidades. Responda a esta pessoa, este desafio, esta ação. Deixe as evasões.",
        en: "Attend to this moment. Immerse yourself in its particulars. Respond to this person, this challenge, this deed. Quit the evasions.",
        es: "Atiende a este momento. Sumérgete en sus particularidades. Responde a esta persona, este desafío, esta acción. Deja las evasiones.",
        author: "epictetus",
        tags: ['focus', 'action', 'time']
    },
    {
        pt: "Decida quem você quer ser. E faça o que precisa ser feito.",
        en: "Decide who you want to be. And do what needs to be done.",
        es: "Decide quién quieres ser. Y haz lo que hay que hacer.",
        author: "epictetus",
        tags: ['action', 'discipline']
    },
    {
        pt: "A chave é manter a companhia apenas de pessoas que te elevam, cuja presença desperta o seu melhor.",
        en: "The key is to keep company only with people who uplift you, whose presence calls forth your best.",
        es: "La clave es mantener compañía solo con personas que te elevan, cuya presencia despierta lo mejor de ti.",
        author: "epictetus",
        tags: ['community', 'learning']
    },
    {
        pt: "Pequenas coisas afetam pequenas mentes.",
        en: "Small things affect small minds.",
        es: "Las cosas pequeñas afectan a las mentes pequeñas.",
        author: "epictetus",
        tags: ['perspective', 'resilience']
    },
    {
        pt: "Se você quer algo bom, pegue-o de si mesmo.",
        en: "If you want anything good, get it from yourself.",
        es: "Si quieres algo bueno, consíguelo de ti mismo.",
        author: "epictetus",
        tags: ['control', 'virtue']
    },
    {
        pt: "Não espere que o mundo lhe deva algo. Crie seu próprio mérito.",
        en: "Do not expect the world to owe you anything. Create your own merit.",
        es: "No esperes que el mundo te deba algo. Crea tu propio mérito.",
        author: "epictetus",
        tags: ['responsibility', 'action']
    },
    {
        pt: "Não permita que o sono desça sobre seus olhos cansados antes de pesar cada ato do dia.",
        en: "Allow not sleep to close your wearied eyes, Until you have reckoned up each daytime deed.",
        es: "No permitas que el sueño cierre tus ojos cansados hasta que hayas sopesado cada acto del día.",
        author: "epictetus",
        tags: ['reflection', 'evening', 'discipline']
    },
    {
        pt: "O homem não está preocupado com problemas reais tanto quanto com suas ansiedades imaginadas sobre problemas reais.",
        en: "Man is not worried by real problems so much as by his imagined anxieties about real problems.",
        es: "El hombre no se preocupa tanto por los problemas reales como por sus ansiedades imaginadas sobre los problemas reales.",
        author: "epictetus",
        tags: ['anxiety', 'perception', 'reality']
    },
    {
        pt: "Faça o que você deve fazer, e não o que agrada aos outros.",
        en: "Do what you must do, not what pleases others.",
        es: "Haz lo que debes hacer, no lo que agrada a los demás.",
        author: "epictetus",
        tags: ['duty', 'virtue', 'action']
    },
    {
        pt: "Ninguém pode ferir você a não ser que você permita.",
        en: "No one can hurt you unless you allow it.",
        es: "Nadie puede herirte a menos que tú lo permitas.",
        author: "epictetus",
        tags: ['control', 'resilience']
    },
    {
        pt: "Se você não quer ser dominado por ninguém, domine a si mesmo.",
        en: "If you do not wish to be dominated by anyone, dominate yourself.",
        es: "Si no quieres ser dominado por nadie, domínate a ti mismo.",
        author: "epictetus",
        tags: ['control', 'discipline']
    },
    {
        pt: "A vida é curta, a arte é longa.",
        en: "Life is short, art is long.",
        es: "La vida es corta, el arte es largo.",
        author: "seneca",
        tags: ['time', 'action', 'learning']
    },
    {
        pt: "O homem sábio não se aflige pelo que não tem, mas se alegra com o que tem.",
        en: "The wise man does not grieve for the things which he has not, but rejoices for those which he has.",
        es: "El hombre sabio no se aflige por lo que no tiene, sino que se alegra por lo que tiene.",
        author: "epictetus",
        tags: ['gratitude', 'temperance']
    },
    {
        pt: "A melhor maneira de prever o futuro é criá-lo.",
        en: "The best way to predict the future is to create it.",
        es: "La mejor manera de predecir el futuro es crearlo.",
        author: "seneca",
        tags: ['action', 'time']
    },
    {
        pt: "Aquele que não sabe se contentar com pouco, não se contentará com nada.",
        en: "He who is not contented with a little, will not be contented with anything.",
        es: "Aquel que no sabe contentarse con poco, no se contentará con nada.",
        author: "epictetus",
        tags: ['temperance', 'gratitude']
    }
];
