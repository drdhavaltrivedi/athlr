/**
 * Haptic feedback for the emotional beats of the app: start, pause,
 * finish, kudos. Wrapped in a guard so builds without the native module
 * (or Android devices without a vibrator) never crash.
 */

let Haptics: typeof import('expo-haptics') | null = null;
try {
  Haptics = require('expo-haptics');
} catch {
  // native module not in this build — haptics become no-ops
}

const safe = (fn: () => Promise<unknown>) => {
  try {
    fn().catch(() => {});
  } catch {}
};

/** Light tick — countdown beats, chip selection. */
export const tapLight = () =>
  safe(() => Haptics!.impactAsync(Haptics!.ImpactFeedbackStyle.Light));

/** Medium thump — pause / resume. */
export const tapMedium = () =>
  safe(() => Haptics!.impactAsync(Haptics!.ImpactFeedbackStyle.Medium));

/** Heavy hit — GO! moment when recording starts. */
export const tapHeavy = () =>
  safe(() => Haptics!.impactAsync(Haptics!.ImpactFeedbackStyle.Heavy));

/** Success notification — activity saved, challenge joined. */
export const notifySuccess = () =>
  safe(() => Haptics!.notificationAsync(Haptics!.NotificationFeedbackType.Success));

/** Warning notification — auto-pause kicked in. */
export const notifyWarning = () =>
  safe(() => Haptics!.notificationAsync(Haptics!.NotificationFeedbackType.Warning));

/** Selection tick — kudo heart, toggles. */
export const tapSelection = () => safe(() => Haptics!.selectionAsync());
