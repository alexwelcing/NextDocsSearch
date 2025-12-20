export interface AssetTask {
  id: string;
  label: string;
  load: () => Promise<unknown>;
}

export interface AssetStage {
  id: string;
  label: string;
  tasks: AssetTask[];
}

export interface AssetQueueOptions {
  onStageStart?: (stage: AssetStage) => void;
  onStageComplete?: (stage: AssetStage) => void;
  onTaskError?: (task: AssetTask, error: unknown) => void;
}

export async function runAssetQueue(stages: AssetStage[], options: AssetQueueOptions = {}) {
  for (const stage of stages) {
    options.onStageStart?.(stage);
    for (const task of stage.tasks) {
      try {
        await task.load();
      } catch (error) {
        options.onTaskError?.(task, error);
      }
    }
    options.onStageComplete?.(stage);
  }
}
