// The app's own training path, for parity-training.mjs: the workout screens'
// storage writes in their order (Q3DaysPerWeek, Q4ProgramDuration, Q6Volume,
// RefinementsScreen), then WorkoutBuildScreen (loadWorkoutProfile ->
// generateProgramAsync -> built_from -> the importer's deload normalising).
// Written from the screens, not from training-part.ts, so the two can be
// compared. APP_DIR is substituted by parity-training.mjs. Training runs first
// from the finish line ("Next: my training"), so storage holds the route's
// lock-in and nothing from the meal questions.
// @ts-nocheck
import { saveGoalsProfile, loadGoalsProfile } from 'APP_DIR/src/utils/goalsProfileStorage';
import { replanRoute } from 'APP_DIR/src/utils/phaseJourney';
import { WorkoutStorage } from 'APP_DIR/src/utils/storage';
import { updateQuestionnaireField, loadQuestionnaireAnswers } from 'APP_DIR/src/utils/questionnaireStorage';
import { DEFAULT_EQUIPMENT } from 'APP_DIR/src/utils/questionnaireRouting';
import { daysScreenPatch, updateTrainingWeek, daysScreenStart } from 'APP_DIR/src/utils/trainingWeek';
import { loadWorkoutProfile, generateProgramAsync } from 'APP_DIR/src/utils/workoutGenerator';
import { builtFromStamp } from 'APP_DIR/src/utils/setupHub';
import { normalizeDeloadWeeks } from 'APP_DIR/src/utils/deloadWeeks';
import { buildEstimateProfile, estimateSessionLength } from 'APP_DIR/src/utils/sessionLengthEstimate';
import { REFINEMENT_PRESETS, isPresetActive, presetSexKey } from 'APP_DIR/src/data/refinementPresets';
const AsyncStorage = require('@react-native-async-storage/async-storage');

/** RouteScreen's lock-in: the profile saved, the route locked. */
async function lockIn(profile: any) {
  await AsyncStorage.clear();
  await saveGoalsProfile(profile);
  await replanRoute('lock', { profile, route: 'balanced' });
}

/** What Q3DaysPerWeekScreen opens on: daysScreenStart(answered, stored week, profile sessions). */
async function q3Start(profile: any) {
  await lockIn(profile);
  const p = await loadGoalsProfile();
  const stored = await WorkoutStorage.loadTrainingWeek().catch(() => null);
  const st = daysScreenStart(undefined, stored as any, p?.trainingSessionsPerWeek);
  return { selected: st.selected, days: st.days, varies: st.varies, time: st.time };
}

/** Q3's panel before anything is saved: the route's profile only. */
async function q3Estimate(profile: any, days: number) {
  await lockIn(profile);
  const base = await loadWorkoutProfile();
  return estimateSessionLength(buildEstimateProfile(base, {}, { totalTrainingDays: days }));
}

async function appProgram(profile: any, a: any) {
  await lockIn(profile);
  // Q3
  await updateQuestionnaireField('totalTrainingDays', a.days);
  await updateTrainingWeek(daysScreenPatch({ daysTouched: false, timeTouched: false, hadWeek: false, varies: false, days: a.week ?? null, selected: a.days, time: null }));
  // Q4
  await updateQuestionnaireField('programDuration', a.length);
  const stored = await loadQuestionnaireAnswers();
  if (!stored?.selectedEquipment?.length) await updateQuestionnaireField('selectedEquipment', DEFAULT_EQUIPMENT);
  // Q6
  await updateQuestionnaireField('volumePreference', a.volume);
  // Refinements
  const sexKey = presetSexKey(profile.sex);
  const state = { priorityMuscles: a.priority, auxiliaryMuscles: a.aux, includeDirectCore: a.core };
  await updateQuestionnaireField('refinementPresets', REFINEMENT_PRESETS.filter((p) => isPresetActive(p, sexKey, state)).map((p) => p.id));
  await updateQuestionnaireField('priorityMuscleGroups', a.priority);
  await updateQuestionnaireField('auxiliaryMuscles', a.aux);
  await updateQuestionnaireField('movementLimitations', a.avoid);
  if (profile.sex) await updateQuestionnaireField('gender', profile.sex);
  await updateQuestionnaireField('includeDirectCore', a.core);
  await updateQuestionnaireField('repStyle', a.rep);
  // WorkoutBuild
  const p = await loadWorkoutProfile();
  const { program, notes } = await generateProgramAsync(p);
  program.built_from = builtFromStamp(p.questionnaire ?? {});
  const parsed = JSON.parse(JSON.stringify(program));
  for (const block of parsed.blocks) {
    if (!block.deload_weeks) continue;
    const [s, e] = String(block.weeks).split('-').map((x: string) => parseInt(x.trim(), 10));
    const d = normalizeDeloadWeeks(block.deload_weeks, s, Number.isFinite(e) ? e : s, block.block_name);
    if (!d.ok) throw new Error(d.error);
    block.deload_weeks = d.weeks;
  }
  return { program: parsed, notes, questionnaire: p.questionnaire };
}

(globalThis as any).AppTraining = { appProgram, q3Estimate, q3Start };
