/**
 * Film Bridge
 * Integration between NextDocsSearch content platform and ComfyUI generation
 */

// Core types
export type {
  ArtifactRegistration,
  ArtifactAppearance,
  ComfyUIConfig,
  ComfyWorkflow,
  QueuedPromptResponse,
  ExecutionStatus,
  ComfyOutput,
  VideoGenerationJob,
  MeshGenerationJob,
  ACCTaskMetadata,
  ProductionStatus,
  DriftReport,
  WorkflowTemplate,
} from './types';

// Clients
export { ComfyClient, getComfyClient } from './comfy-client';
export { ACCFilmClient, getACCFilmClient, FILM_CATEGORY_ROUTING } from './acc-integration';

// Registry
export { ArtifactRegistry, getArtifactRegistry } from './artifact-registry';

// Service Management
export { 
  ComfyService, 
  getComfyService,
  type ComfyServiceConfig,
  type VRAMStatus,
  type ComfyHealth,
  type ModelLoadRequest,
} from './service/comfy-service';
