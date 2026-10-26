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
import {
  buildEstimateProfile, estimateDays, lowerVolume, lowerVolumeNote, moreDaysOptions, moreDaysNote, fewerPriorities, FEWER_PRIORITIES_KEEP,
  VOLUME_LABEL, usefulFixes, sessionLengthTone, longSessionLine,
} from 'APP_DIR/src/utils/sessionLengthEstimate';
import * as VC from 'APP_DIR/src/utils/volumeChoice';
import { VOLUME_COPY } from 'APP_DIR/src/data/volumeCopy';
import { clockLabel, daysLabel as weekDaysLabel, ROUGH_LABEL, loadTrainingWeek } from 'APP_DIR/src/utils/trainingWeek';
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
 * Q6VolumePreferenceScreen as it opens from the finish line (nothing saved), the
 * one-at-a-time picker (26 Oct 2026): the tier picked for them, the ramp-in line,
 * and every step (volumeSteps(customSets): the four tiers, plus a custom number
 * from "Set my own") with its name, line, growth %, weekly time at the saved days
 * (estimateDays: 4 before Days) and the Less / More trades on its buttons.
 */
async function q6View(profile: any, customSets: number | null = null) {
  await lockIn(profile);
  const base = await loadWorkoutProfile();
  const days = estimateDays(base?.questionnaire?.totalTrainingDays);
  const steps = VC.volumeSteps(customSets);
  const mins: any = {};
  for (const s of steps) mins[s.key] = weeklyMinutes(await variant({}, { ...VC.volumeOverride(s.value, s.customWeeklySets), totalTrainingDays: days }));
  const view = steps.map((s, i) => {
    const trade = (o: any) => (o ? `${VC.growthDelta(s.sets, o.sets)} · ${VC.weekTimeDelta(mins[o.key] - mins[s.key])}` : null);
    return {
      key: s.key, name: s.name, what: s.what, growth: VC.growthPercent(s.sets), pctLink: VOLUME_COPY.pctLink(VC.growthPercent(s.sets)),
      hours: VC.halfHoursLabel(mins[s.key]), less: trade(steps[i - 1]), more: trade(steps[i + 1]),
    };
  });
  return { recommended: VC.recommendedVolume(base?.goalsProfile?.trainingState), rampsIn: rampsIn(base?.goalsProfile?.trainingState), steps: view };
}

/** VolumeOwnSheet at N sets: the readout (sets, growth, weekly time at the screen's days) and the Use button. */
async function ownView(profile: any, n: number) {
  await lockIn(profile);
  const base = await loadWorkoutProfile();
  const days = estimateDays(base?.questionnaire?.totalTrainingDays);
  const m = weeklyMinutes(await variant({}, { ...VC.volumeOverride('custom', n), totalTrainingDays: days }));
  return { sets: n, growth: `${VC.growthPercent(n)}%`, week: VC.halfHoursLabel(m as number), use: VOLUME_COPY.ownUse(n), tier: VC.tierForSets(n) };
}

/** Q3 after Volume saved `vol`: every tile's minutes, and one step less volume at `days`. */
async function q3View(profile: any, vol: string, days: number, custom: number | null = null) {
  await lockIn(profile);
  await updateQuestionnaireField('volumePreference', vol);
  await updateQuestionnaireField('customWeeklySets', vol === 'custom' ? custom : undefined);
  const answers = VC.volumeOverride(vol as any, custom);
  const tiles: any = {};
  for (const n of [2, 3, 4, 5, 6]) {
    const e = await variant(answers, { totalTrainingDays: n, ...VC.volumeOverride(vol as any, custom) });
    tiles[n] = { headline: e.headline, average: e.average, days: e.days, week: weeklyMinutes(e) };
  }
  const down = lowerVolume(vol, custom);
  const d = down ? await variant(answers, { totalTrainingDays: days, volumePreference: down }) : null;
  // The week line above the tiles: "EACH WEEK · <tier>", "about N h of lifting" at the picked count.
  const weekLine = [VOLUME_COPY.daysWeekLine(VC.volumeShortLabel(vol, custom) ?? 'Moderate'), VOLUME_COPY.daysWeekHours(VC.halfHoursLabel(tiles[days].week))];
  return { tiles, down: d ? { headline: d.headline, average: d.average, label: VC.volumeLabel(down) } : null, weekLine, cardLabel: VC.volumeLabel(vol, custom) };
}

async function appProgram(profile: any, a: any) {
  await lockIn(profile);
  // Q6: the tier picked (or tapped), or 'custom' and its number, is saved on Continue.
  await updateQuestionnaireField('volumePreference', a.volume);
  await updateQuestionnaireField('customWeeklySets', a.volume === 'custom' ? a.custom : undefined);
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
  // Refinements -> the summary, "Here's your week" (afterRefinementsRoute, 26 Oct 2026).
  const summary = await summaryView();
  // Changes made there: the week sheet's Save ({ days, time, exactMinute, asked }).
  let after = null;
  if (a.sheet) {
    await updateTrainingWeek({ days: a.sheet.days, time: a.sheet.time, exactMinute: a.sheet.exactMinute ?? null, asked: true });
    if (a.sheet.rebuild) await updateQuestionnaireField('totalTrainingDays', a.sheet.days.length);
    after = await summaryView();
  }
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
  return { program: parsed, notes, questionnaire: p.questionnaire, summary, after };
}

/**
 * QuestionnaireSummaryScreen ("Here's your week") on the stored answers: the
 * rows, the Training week row, and the session panel (block 1 minutes, the
 * fixes it builds when long, the ones worth showing).
 */
async function summaryView() {
  const answers: any = await loadQuestionnaireAnswers();
  const saved = await loadWorkoutProfile();
  const week = await loadTrainingWeek();
  const planDays = answers.totalTrainingDays ?? null;
  const weekValue = week.days ? weekDaysLabel(week.days) : weekDaysLabel(null, planDays);
  const timeValue = week.exactMinute != null ? `Around ${clockLabel(week.exactMinute)}` : week.time === 'varies' ? 'Time varies' : ROUGH_LABEL[week.time];
  const detail = week.exactMinute == null && week.time === 'varies' ? 'Add a rough time, or say your days change' : week.days ? timeValue : `${timeValue} · days change week to week`;
  const value = {
    totalTrainingDays: answers.totalTrainingDays, programDuration: answers.programDuration, selectedEquipment: answers.selectedEquipment,
    volumePreference: answers.volumePreference, customWeeklySets: answers.customWeeklySets,
    priorityMuscleGroups: answers.priorityMuscleGroups ?? [], auxiliaryMuscles: answers.auxiliaryMuscles ?? [], movementLimitations: answers.movementLimitations ?? [],
    includeDirectCore: answers.includeDirectCore !== false, repStyle: answers.repStyle ?? 'classic',
  };
  const fixes: any[] = [];
  const down = lowerVolume(answers.volumePreference, answers.customWeeklySets);
  if (down) fixes.push({ key: 'volume-down', override: { volumePreference: down }, label: `${VOLUME_LABEL[down]} volume`, note: lowerVolumeNote(down) });
  for (const n of moreDaysOptions(answers.totalTrainingDays, 1)) fixes.push({ key: `days-${n}`, override: { totalTrainingDays: n }, label: `Train ${n} days`, note: moreDaysNote(answers.totalTrainingDays ?? n) });
  const fewer = fewerPriorities(answers.priorityMuscleGroups);
  if (fewer) fixes.push({ key: 'priorities-fewer', override: { priorityMuscleGroups: fewer }, label: 'Fewer priority muscles', note: `if you keep ${FEWER_PRIORITIES_KEEP}` });
  const est = await estimateCached(buildEstimateProfile(saved, answers, value), () => false);
  const ests: any = {};
  if (sessionLengthTone(est.average) !== 'ok') for (const f of fixes) ests[f.key] = await estimateCached(buildEstimateProfile(saved, answers, { ...value, ...f.override }), () => false);
  const offered = sessionLengthTone(est.average) !== 'ok' ? usefulFixes(est.average, fixes, ests).map((f: any) => ({ key: f.key, label: f.label, note: f.note, headline: f.est.headline })) : [];
  return {
    volume: VC.volumeLabel(answers.volumePreference, answers.customWeeklySets), days: answers.totalTrainingDays, length: answers.programDuration,
    week: { weekValue, timeValue, detail }, fixes: fixes.map((f) => ({ key: f.key, label: f.label, note: f.note })),
    panel: { headline: est.headline, average: est.average, days: est.days, longLine: longSessionLine(est.average, offered.length > 0), offered },
  };
}

(globalThis as any).AppTraining = { appProgram, q3Start, q6View, q3View, ownView, VC: { ...VC, lowerVolume } };
