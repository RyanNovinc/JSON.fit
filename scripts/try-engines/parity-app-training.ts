// The app's own training path, for parity-training.mjs: the workout screens'
// storage writes in their order (Q6Volume, Q3DaysPerWeek, Q4ProgramDuration,
// RefinementsScreen: volume first since 24 Oct 2026), then WorkoutBuildScreen (loadWorkoutProfile ->
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
import { daysScreenPatch, updateTrainingWeek, daysScreenStart, sanitiseTrainingWeek } from 'APP_DIR/src/utils/trainingWeek';
import { daysForCount, sortMonFirst } from 'APP_DIR/src/utils/weekStrip';
import { estimateCached, weeklyMinutes, hoursLabel } from 'APP_DIR/src/hooks/useSessionEstimates';
import { rampsIn } from 'APP_DIR/src/utils/workoutGenerator/check';
import { loadWorkoutProfile, generateProgramAsync } from 'APP_DIR/src/utils/workoutGenerator';
import { builtFromStamp } from 'APP_DIR/src/utils/setupHub';
import { normalizeDeloadWeeks } from 'APP_DIR/src/utils/deloadWeeks';
import { buildEstimateProfile, estimateDays, lowerVolume } from 'APP_DIR/src/utils/sessionLengthEstimate';
import { REFINEMENT_PRESETS, isPresetActive, presetSexKey } from 'APP_DIR/src/data/refinementPresets';
const AsyncStorage = require('@react-native-async-storage/async-storage');

/** RouteScreen's lock-in: the profile saved, the route locked. */
async function lockIn(profile: any) {
  await AsyncStorage.clear();
  await saveGoalsProfile(profile);
  await replanRoute('lock', { profile, route: 'balanced' });
}

/**
 * What Q3DaysPerWeekScreen opens on (its load effect): daysScreenStart(answered,
 * stored week, profile sessions), kept to 2 to 6 by estimateDays; out of range
 * opens on the nearest offered week and counts as changed.
 */
async function daysOpening() {
  const p = await loadGoalsProfile();
  const raw = await WorkoutStorage.loadTrainingWeek().catch(() => null);
  const w = raw ? sanitiseTrainingWeek(raw) : null;
  const start = daysScreenStart(undefined, w as any, (p as any)?.trainingSessionsPerWeek);
  const n = estimateDays(start.selected);
  const off = start.selected !== n || (start.days && start.days.length !== n);
  return { selected: n, days: off ? daysForCount(n) : start.days ? sortMonFirst(start.days) : daysForCount(n), varies: start.varies, time: start.time, touched: !!off, hadWeek: !!w?.asked };
}
async function q3Start(profile: any) {
  await lockIn(profile);
  return daysOpening();
}

/** useSessionEstimates, one variant: the saved answers + answersSoFar + its override, built in slices. */
async function variant(answers: any, override: any) {
  const base = await loadWorkoutProfile();
  return estimateCached(buildEstimateProfile(base, answers, override), () => false);
}

/**
 * Q6VolumePreferenceScreen as it opens from the finish line (nothing saved): the
 * tier picked for them, the reassurance line's ramp-in, and each tier's weekly time
 * at the saved days (estimateDays: 4 before Days).
 */
async function q6View(profile: any) {
  await lockIn(profile);
  const base = await loadWorkoutProfile();
  const days = estimateDays(base?.questionnaire?.totalTrainingDays);
  const hours: any = {};
  for (const v of ['8-12', '12-16', '16-20']) hours[v] = hoursLabel(weeklyMinutes(await variant({}, { volumePreference: v, totalTrainingDays: days })) as number);
  return { recommended: base?.goalsProfile?.trainingState === 'new' ? '8-12' : '12-16', rampsIn: rampsIn(base?.goalsProfile?.trainingState), hours };
}

/** Q3 after Volume saved `vol`: every tile's minutes, and one step less volume at `days`. */
async function q3View(profile: any, vol: string, days: number) {
  await lockIn(profile);
  await updateQuestionnaireField('volumePreference', vol);
  const answers = { volumePreference: vol };
  const tiles: any = {};
  for (const n of [2, 3, 4, 5, 6]) {
    const e = await variant(answers, { totalTrainingDays: n, volumePreference: vol });
    tiles[n] = { headline: e.headline, average: e.average, days: e.days };
  }
  const down = lowerVolume(vol);
  const d = down ? await variant(answers, { totalTrainingDays: days, volumePreference: down }) : null;
  return { tiles, down: d ? { headline: d.headline, average: d.average } : null };
}

async function appProgram(profile: any, a: any) {
  await lockIn(profile);
  // Q6: the tier picked (or tapped) is saved on Continue.
  await updateQuestionnaireField('volumePreference', a.volume);
  // Q3: opens on the stored week (else 4); a tapped number fills its usual week,
  // tapped weekdays set their own; a lower-volume suggestion saves straight away.
  const open = await daysOpening();
  let touched = open.touched, days = open.days;
  if (a.days !== open.selected || a.week) { touched = true; days = a.week ?? daysForCount(a.days); }
  if (a.lowerTo) await updateQuestionnaireField('volumePreference', a.lowerTo);
  await updateQuestionnaireField('totalTrainingDays', a.days);
  await updateTrainingWeek(daysScreenPatch({ daysTouched: touched, timeTouched: false, hadWeek: open.hadWeek, varies: open.varies, days, selected: a.days, time: open.time }));
  // Q4
  await updateQuestionnaireField('programDuration', a.length);
  const stored = await loadQuestionnaireAnswers();
  if (!stored?.selectedEquipment?.length) await updateQuestionnaireField('selectedEquipment', DEFAULT_EQUIPMENT);
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

(globalThis as any).AppTraining = { appProgram, q3Start, q6View, q3View };
