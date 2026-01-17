
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file data/predefinedHabits.ts
 * @description Catálogo estático de templates de hábitos pré-configurados.
 * 
 * [SHARED CONTEXT: MAIN THREAD & WORKER]:
 * Este arquivo é isomórfico. Ele é importado tanto pela UI (render/modals.ts) para exibir a lista de escolha,
 * quanto pelo Web Worker (sync.worker.ts) para gerar prompts de IA contextuais baseados em templates.
 * 
 * ARQUITETURA DE DADOS:
 * - Imutabilidade: Estes objetos servem apenas como "Carimbos" (Blueprints) para criar novas instâncias de Habits.
 * - I18n: Usa chaves de tradução (nameKey, subtitleKey) em vez de texto hardcoded para suportar troca dinâmica de idioma.
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `HABIT_ICONS` (data/icons.ts): Deve conter apenas strings SVG puras, sem dependências de DOM (HTMLElement),
 *   para garantir que este arquivo possa ser importado dentro do Worker sem causar erro "document is not defined".
 */

import { PredefinedHabit } from '../state';
// ARCHITECTURE FIX [2025-03-22]: Importa de data/icons.ts para garantir segurança no Worker.
// Evita importar de render/icons.ts que pode conter lógica de DOM no futuro.
import { HABIT_ICONS } from './icons';

// DO NOT REFACTOR: A estrutura deve corresponder estritamente ao tipo PredefinedHabit
// para garantir a serialização correta entre threads (postMessage) e compatibilidade com o sistema de tipos.
// Predefined habits configuration using keys for localization
export const PREDEFINED_HABITS: PredefinedHabit[] = [
    { nameKey: 'predefinedHabitReadName', subtitleKey: 'predefinedHabitReadSubtitle', icon: HABIT_ICONS.read, color: '#e74c3c', times: ['Evening'], goal: { type: 'pages', total: 10, unitKey: 'unitPage' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitMeditateName', subtitleKey: 'predefinedHabitMeditateSubtitle', icon: HABIT_ICONS.meditate, color: '#f1c40f', times: ['Morning'], goal: { type: 'minutes', total: 10, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    // LOGIC LOCK: 'isDefault: true' define o hábito sugerido no onboarding (Cold Start). Apenas um deve ter essa flag.
    { nameKey: 'predefinedHabitWaterName', subtitleKey: 'predefinedHabitWaterSubtitle', icon: HABIT_ICONS.water, color: '#3498db', times: ['Morning', 'Afternoon', 'Evening'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' }, isDefault: true },
    { nameKey: 'predefinedHabitExerciseName', subtitleKey: 'predefinedHabitExerciseSubtitle', icon: HABIT_ICONS.exercise, color: '#2ecc71', times: ['Afternoon'], goal: { type: 'minutes', total: 30, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitStretchName', subtitleKey: 'predefinedHabitStretchSubtitle', icon: HABIT_ICONS.stretch, color: '#7f8c8d', times: ['Morning'], goal: { type: 'minutes', total: 5, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitJournalName', subtitleKey: 'predefinedHabitJournalSubtitle', icon: HABIT_ICONS.journal, color: '#9b59b6', times: ['Evening'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitLanguageName', subtitleKey: 'predefinedHabitLanguageSubtitle', icon: HABIT_ICONS.language, color: '#1abc9c', times: ['Afternoon'], goal: { type: 'minutes', total: 20, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitOrganizeName', subtitleKey: 'predefinedHabitOrganizeSubtitle', icon: HABIT_ICONS.organize, color: '#34495e', times: ['Evening'], goal: { type: 'minutes', total: 15, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitWalkName', subtitleKey: 'predefinedHabitWalkSubtitle', icon: HABIT_ICONS.walk, color: '#27ae60', times: ['Afternoon'], goal: { type: 'minutes', total: 20, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitPlanDayName', subtitleKey: 'predefinedHabitPlanDaySubtitle', icon: HABIT_ICONS.planDay, color: '#007aff', times: ['Morning'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitCreativeHobbyName', subtitleKey: 'predefinedHabitCreativeHobbySubtitle', icon: HABIT_ICONS.creativeHobby, color: '#e84393', times: ['Afternoon'], goal: { type: 'minutes', total: 30, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitGratitudeName', subtitleKey: 'predefinedHabitGratitudeSubtitle', icon: HABIT_ICONS.gratitude, color: '#f39c12', times: ['Evening'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitEatFruitName', subtitleKey: 'predefinedHabitEatFruitSubtitle', icon: HABIT_ICONS.eatFruit, color: '#c0392b', times: ['Afternoon'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitTalkFriendName', subtitleKey: 'predefinedHabitTalkFriendSubtitle', icon: HABIT_ICONS.talkFriend, color: '#3498db', times: ['Afternoon'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitScreenBreakName', subtitleKey: 'predefinedHabitScreenBreakSubtitle', icon: HABIT_ICONS.screenBreak, color: '#9b59b6', times: ['Afternoon'], goal: { type: 'minutes', total: 15, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitInstrumentName', subtitleKey: 'predefinedHabitInstrumentSubtitle', icon: HABIT_ICONS.instrument, color: '#e67e22', times: ['Evening'], goal: { type: 'minutes', total: 20, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitPlantsName', subtitleKey: 'predefinedHabitPlantsSubtitle', icon: HABIT_ICONS.plants, color: '#2ecc71', times: ['Morning'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitFinancesName', subtitleKey: 'predefinedHabitFinancesSubtitle', icon: HABIT_ICONS.finances, color: '#34495e', times: ['Evening'], goal: { type: 'minutes', total: 10, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitTeaName', subtitleKey: 'predefinedHabitTeaSubtitle', icon: HABIT_ICONS.tea, color: '#1abc9c', times: ['Evening'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitPodcastName', subtitleKey: 'predefinedHabitPodcastSubtitle', icon: HABIT_ICONS.podcast, color: '#007aff', times: ['Afternoon'], goal: { type: 'minutes', total: 25, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitEmailsName', subtitleKey: 'predefinedHabitEmailsSubtitle', icon: HABIT_ICONS.emails, color: '#f1c40f', times: ['Morning'], goal: { type: 'minutes', total: 5, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitSkincareName', subtitleKey: 'predefinedHabitSkincareSubtitle', icon: HABIT_ICONS.skincare, color: '#e84393', times: ['Evening'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitSunlightName', subtitleKey: 'predefinedHabitSunlightSubtitle', icon: HABIT_ICONS.sunlight, color: '#f39c12', times: ['Morning'], goal: { type: 'minutes', total: 10, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitDisconnectName', subtitleKey: 'predefinedHabitDisconnectSubtitle', icon: HABIT_ICONS.disconnect, color: '#2980b9', times: ['Evening'], goal: { type: 'minutes', total: 30, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitDrawName', subtitleKey: 'predefinedHabitDrawSubtitle', icon: HABIT_ICONS.draw, color: '#8e44ad', times: ['Afternoon'], goal: { type: 'minutes', total: 15, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitFamilyTimeName', subtitleKey: 'predefinedHabitFamilyTimeSubtitle', icon: HABIT_ICONS.familyTime, color: '#f1c40f', times: ['Evening'], goal: { type: 'minutes', total: 30, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitNewsName', subtitleKey: 'predefinedHabitNewsSubtitle', icon: HABIT_ICONS.news, color: '#7f8c8d', times: ['Morning'], goal: { type: 'minutes', total: 10, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitCookHealthyName', subtitleKey: 'predefinedHabitCookHealthySubtitle', icon: HABIT_ICONS.cookHealthy, color: '#27ae60', times: ['Evening'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitLearnSkillName', subtitleKey: 'predefinedHabitLearnSkillSubtitle', icon: HABIT_ICONS.learnSkill, color: '#3498db', times: ['Afternoon'], goal: { type: 'minutes', total: 20, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitPhotographyName', subtitleKey: 'predefinedHabitPhotographySubtitle', icon: HABIT_ICONS.photography, color: '#34495e', times: ['Afternoon'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitVolunteerName', subtitleKey: 'predefinedHabitVolunteerSubtitle', icon: HABIT_ICONS.gratitude, color: '#e74c3c', times: ['Afternoon'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitYogaName', subtitleKey: 'predefinedHabitYogaSubtitle', icon: HABIT_ICONS.yoga, color: '#9b59b6', times: ['Morning'], goal: { type: 'minutes', total: 15, unitKey: 'unitMin' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitReflectDayName', subtitleKey: 'predefinedHabitReflectDaySubtitle', icon: HABIT_ICONS.reflectDay, color: '#2980b9', times: ['Evening'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitNoComplaintName', subtitleKey: 'predefinedHabitNoComplaintSubtitle', icon: HABIT_ICONS.disconnect, color: '#e67e22', times: ['Morning', 'Afternoon', 'Evening'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitReviewDayName', subtitleKey: 'predefinedHabitReviewDaySubtitle', icon: HABIT_ICONS.journal, color: '#7f8c8d', times: ['Evening'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } },
    { nameKey: 'predefinedHabitStoicismName', subtitleKey: 'predefinedHabitStoicismSubtitle', icon: HABIT_ICONS.meditate, color: '#34495e', times: ['Morning'], goal: { type: 'check', unitKey: 'unitCheck' }, frequency: { type: 'daily' } }
];
