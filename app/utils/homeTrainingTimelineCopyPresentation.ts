
/**
 * SMD Training Timeline
 * Display-only copy override.
 * Original Figma source remains unchanged.
 */
export const homeTrainingTimelineCopy: Readonly<Record<string, string>> =
  Object.freeze({
    'node-1:492': '오전',
    'node-1:493': '밑작업',
    'node-1:499': '프라이머',
    'node-1:498': '오후',
    'node-1:494': '필름 래핑',
  });

export function homeTrainingTimelineVisibleText(
  nodeKey: string,
  source: string,
): string {
  return homeTrainingTimelineCopy[nodeKey] ?? source;
}
