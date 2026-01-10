/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODERN WORKSHOP - STATE MANAGEMENT PROVIDER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Context provider for managing workshop resources, categories, and UI state.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';

import type {
  WorkshopResource,
  MindMapStructure,
  MindMapCategory,
  WorkshopFilters,
  ResourceType,
  ProcessingStatus,
  QualityScore,
} from '@/types/workshop';
import { WORKSHOP_MIND_MAP, getDescendants, getAncestorPath } from '@/lib/workshop/mindmap-data';
import { SEED_RESOURCES, calculateResourceCounts } from '@/lib/workshop/seed-data';

// ═══════════════════════════════════════════════════════════════════════════
// STATE TYPES
// ═══════════════════════════════════════════════════════════════════════════

type ViewMode = 'mindmap' | 'list' | 'grid' | 'timeline';

interface WorkshopState {
  // Data
  mindMap: MindMapStructure;
  resources: Record<string, WorkshopResource>;
  resourceCounts: Record<string, number>;

  // UI State
  selectedCategoryId: string | null;
  selectedResourceId: string | null;
  expandedCategories: Set<string>;
  hoveredCategoryId: string | null;
  hoveredResourceId: string | null;

  // View
  viewMode: ViewMode;
  searchQuery: string;
  searchResults: string[];

  // Filters
  filters: WorkshopFilters;

  // Loading
  isLoading: boolean;
  processingIds: Set<string>;

  // 3D specific
  focusedNodeId: string | null;
  cameraTarget: [number, number, number] | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

type WorkshopAction =
  | { type: 'SET_RESOURCES'; resources: WorkshopResource[] }
  | { type: 'ADD_RESOURCE'; resource: WorkshopResource }
  | { type: 'UPDATE_RESOURCE'; id: string; updates: Partial<WorkshopResource> }
  | { type: 'DELETE_RESOURCE'; id: string }
  | { type: 'SELECT_CATEGORY'; categoryId: string | null }
  | { type: 'SELECT_RESOURCE'; resourceId: string | null }
  | { type: 'TOGGLE_CATEGORY_EXPAND'; categoryId: string }
  | { type: 'EXPAND_TO_CATEGORY'; categoryId: string }
  | { type: 'SET_HOVERED_CATEGORY'; categoryId: string | null }
  | { type: 'SET_HOVERED_RESOURCE'; resourceId: string | null }
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_SEARCH_RESULTS'; results: string[] }
  | { type: 'SET_FILTERS'; filters: Partial<WorkshopFilters> }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'ADD_PROCESSING_ID'; id: string }
  | { type: 'REMOVE_PROCESSING_ID'; id: string }
  | { type: 'SET_FOCUS_NODE'; nodeId: string | null }
  | { type: 'SET_CAMERA_TARGET'; target: [number, number, number] | null }
  | { type: 'BOOKMARK_RESOURCE'; resourceId: string; bookmarked: boolean }
  | { type: 'INCREMENT_VIEW_COUNT'; resourceId: string };

// ═══════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_FILTERS: WorkshopFilters = {
  types: [],
  statuses: [],
  minQuality: 1,
  tags: [],
  sources: [],
};

function createInitialState(): WorkshopState {
  // Convert seed resources to record
  const resourcesRecord: Record<string, WorkshopResource> = {};
  for (const resource of SEED_RESOURCES) {
    resourcesRecord[resource.id] = resource;
  }

  // Calculate resource counts
  const resourceCounts = calculateResourceCounts(SEED_RESOURCES);

  // Initially expand root and first level
  const expandedCategories = new Set<string>();
  expandedCategories.add(WORKSHOP_MIND_MAP.rootId);

  return {
    mindMap: WORKSHOP_MIND_MAP,
    resources: resourcesRecord,
    resourceCounts,
    selectedCategoryId: null,
    selectedResourceId: null,
    expandedCategories,
    hoveredCategoryId: null,
    hoveredResourceId: null,
    viewMode: 'mindmap',
    searchQuery: '',
    searchResults: [],
    filters: DEFAULT_FILTERS,
    isLoading: false,
    processingIds: new Set(),
    focusedNodeId: null,
    cameraTarget: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REDUCER
// ═══════════════════════════════════════════════════════════════════════════

function workshopReducer(state: WorkshopState, action: WorkshopAction): WorkshopState {
  switch (action.type) {
    case 'SET_RESOURCES': {
      const resources: Record<string, WorkshopResource> = {};
      for (const resource of action.resources) {
        resources[resource.id] = resource;
      }
      return {
        ...state,
        resources,
        resourceCounts: calculateResourceCounts(action.resources),
      };
    }

    case 'ADD_RESOURCE': {
      const newResources = {
        ...state.resources,
        [action.resource.id]: action.resource,
      };
      return {
        ...state,
        resources: newResources,
        resourceCounts: calculateResourceCounts(Object.values(newResources)),
      };
    }

    case 'UPDATE_RESOURCE': {
      const existing = state.resources[action.id];
      if (!existing) return state;

      const updated = {
        ...existing,
        ...action.updates,
        updatedAt: new Date().toISOString(),
      };

      return {
        ...state,
        resources: {
          ...state.resources,
          [action.id]: updated,
        },
      };
    }

    case 'DELETE_RESOURCE': {
      const { [action.id]: removed, ...remaining } = state.resources;
      return {
        ...state,
        resources: remaining,
        resourceCounts: calculateResourceCounts(Object.values(remaining)),
        selectedResourceId:
          state.selectedResourceId === action.id ? null : state.selectedResourceId,
      };
    }

    case 'SELECT_CATEGORY': {
      return {
        ...state,
        selectedCategoryId: action.categoryId,
        focusedNodeId: action.categoryId,
      };
    }

    case 'SELECT_RESOURCE': {
      return {
        ...state,
        selectedResourceId: action.resourceId,
        focusedNodeId: action.resourceId,
      };
    }

    case 'TOGGLE_CATEGORY_EXPAND': {
      const newExpanded = new Set(state.expandedCategories);
      if (newExpanded.has(action.categoryId)) {
        newExpanded.delete(action.categoryId);
      } else {
        newExpanded.add(action.categoryId);
      }
      return {
        ...state,
        expandedCategories: newExpanded,
      };
    }

    case 'EXPAND_TO_CATEGORY': {
      const path = getAncestorPath(action.categoryId);
      const newExpanded = new Set(state.expandedCategories);
      for (const id of path) {
        newExpanded.add(id);
      }
      return {
        ...state,
        expandedCategories: newExpanded,
        selectedCategoryId: action.categoryId,
        focusedNodeId: action.categoryId,
      };
    }

    case 'SET_HOVERED_CATEGORY':
      return { ...state, hoveredCategoryId: action.categoryId };

    case 'SET_HOVERED_RESOURCE':
      return { ...state, hoveredResourceId: action.resourceId };

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };

    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.results };

    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.filters },
      };

    case 'CLEAR_FILTERS':
      return { ...state, filters: DEFAULT_FILTERS };

    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };

    case 'ADD_PROCESSING_ID': {
      const newProcessing = new Set(state.processingIds);
      newProcessing.add(action.id);
      return { ...state, processingIds: newProcessing };
    }

    case 'REMOVE_PROCESSING_ID': {
      const newProcessing = new Set(state.processingIds);
      newProcessing.delete(action.id);
      return { ...state, processingIds: newProcessing };
    }

    case 'SET_FOCUS_NODE':
      return { ...state, focusedNodeId: action.nodeId };

    case 'SET_CAMERA_TARGET':
      return { ...state, cameraTarget: action.target };

    case 'BOOKMARK_RESOURCE': {
      const resource = state.resources[action.resourceId];
      if (!resource) return state;

      return {
        ...state,
        resources: {
          ...state.resources,
          [action.resourceId]: {
            ...resource,
            bookmarked: action.bookmarked,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }

    case 'INCREMENT_VIEW_COUNT': {
      const resource = state.resources[action.resourceId];
      if (!resource) return state;

      return {
        ...state,
        resources: {
          ...state.resources,
          [action.resourceId]: {
            ...resource,
            viewCount: resource.viewCount + 1,
          },
        },
      };
    }

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface WorkshopContextValue {
  // State
  state: WorkshopState;

  // Category actions
  selectCategory: (categoryId: string | null) => void;
  toggleCategoryExpand: (categoryId: string) => void;
  expandToCategory: (categoryId: string) => void;
  setHoveredCategory: (categoryId: string | null) => void;

  // Resource actions
  selectResource: (resourceId: string | null) => void;
  addResource: (resource: WorkshopResource) => void;
  updateResource: (id: string, updates: Partial<WorkshopResource>) => void;
  deleteResource: (id: string) => void;
  bookmarkResource: (resourceId: string, bookmarked: boolean) => void;
  incrementViewCount: (resourceId: string) => void;
  setHoveredResource: (resourceId: string | null) => void;

  // View actions
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<WorkshopFilters>) => void;
  clearFilters: () => void;

  // 3D actions
  setFocusNode: (nodeId: string | null) => void;
  setCameraTarget: (target: [number, number, number] | null) => void;

  // Computed values
  filteredResources: WorkshopResource[];
  resourcesInCategory: (categoryId: string, includeDescendants?: boolean) => WorkshopResource[];
  getCategoryPath: (categoryId: string) => MindMapCategory[];
  getCategory: (categoryId: string) => MindMapCategory | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const WorkshopContext = createContext<WorkshopContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

interface WorkshopProviderProps {
  children: ReactNode;
}

export function WorkshopProvider({ children }: WorkshopProviderProps) {
  const [state, dispatch] = useReducer(workshopReducer, null, createInitialState);

  // ═══════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  const selectCategory = useCallback((categoryId: string | null) => {
    dispatch({ type: 'SELECT_CATEGORY', categoryId });
  }, []);

  const toggleCategoryExpand = useCallback((categoryId: string) => {
    dispatch({ type: 'TOGGLE_CATEGORY_EXPAND', categoryId });
  }, []);

  const expandToCategory = useCallback((categoryId: string) => {
    dispatch({ type: 'EXPAND_TO_CATEGORY', categoryId });
  }, []);

  const setHoveredCategory = useCallback((categoryId: string | null) => {
    dispatch({ type: 'SET_HOVERED_CATEGORY', categoryId });
  }, []);

  const selectResource = useCallback((resourceId: string | null) => {
    dispatch({ type: 'SELECT_RESOURCE', resourceId });
  }, []);

  const addResource = useCallback((resource: WorkshopResource) => {
    dispatch({ type: 'ADD_RESOURCE', resource });
  }, []);

  const updateResource = useCallback((id: string, updates: Partial<WorkshopResource>) => {
    dispatch({ type: 'UPDATE_RESOURCE', id, updates });
  }, []);

  const deleteResource = useCallback((id: string) => {
    dispatch({ type: 'DELETE_RESOURCE', id });
  }, []);

  const bookmarkResource = useCallback((resourceId: string, bookmarked: boolean) => {
    dispatch({ type: 'BOOKMARK_RESOURCE', resourceId, bookmarked });
  }, []);

  const incrementViewCount = useCallback((resourceId: string) => {
    dispatch({ type: 'INCREMENT_VIEW_COUNT', resourceId });
  }, []);

  const setHoveredResource = useCallback((resourceId: string | null) => {
    dispatch({ type: 'SET_HOVERED_RESOURCE', resourceId });
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', mode });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', query });

    // Simple search implementation
    if (!query.trim()) {
      dispatch({ type: 'SET_SEARCH_RESULTS', results: [] });
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results = Object.values(state.resources)
      .filter(
        r =>
          r.title.toLowerCase().includes(lowerQuery) ||
          r.description.toLowerCase().includes(lowerQuery) ||
          r.tags.some(t => t.toLowerCase().includes(lowerQuery))
      )
      .map(r => r.id);

    dispatch({ type: 'SET_SEARCH_RESULTS', results });
  }, [state.resources]);

  const setFilters = useCallback((filters: Partial<WorkshopFilters>) => {
    dispatch({ type: 'SET_FILTERS', filters });
  }, []);

  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' });
  }, []);

  const setFocusNode = useCallback((nodeId: string | null) => {
    dispatch({ type: 'SET_FOCUS_NODE', nodeId });
  }, []);

  const setCameraTarget = useCallback((target: [number, number, number] | null) => {
    dispatch({ type: 'SET_CAMERA_TARGET', target });
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════════

  const filteredResources = useMemo(() => {
    const resources = Object.values(state.resources);
    const { filters, searchQuery } = state;

    return resources.filter(resource => {
      // Search filter
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        if (
          !resource.title.toLowerCase().includes(lowerQuery) &&
          !resource.description.toLowerCase().includes(lowerQuery)
        ) {
          return false;
        }
      }

      // Type filter
      if (filters.types.length > 0 && !filters.types.includes(resource.type)) {
        return false;
      }

      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(resource.status)) {
        return false;
      }

      // Quality filter
      if (
        resource.enrichedData?.qualityScore &&
        resource.enrichedData.qualityScore < filters.minQuality
      ) {
        return false;
      }

      // Tag filter
      if (
        filters.tags.length > 0 &&
        !filters.tags.some(tag => resource.tags.includes(tag))
      ) {
        return false;
      }

      // Source filter
      if (filters.sources.length > 0 && !filters.sources.includes(resource.source)) {
        return false;
      }

      return true;
    });
  }, [state.resources, state.filters, state.searchQuery]);

  const resourcesInCategory = useCallback(
    (categoryId: string, includeDescendants: boolean = true): WorkshopResource[] => {
      const categoryIds = includeDescendants
        ? [categoryId, ...getDescendants(categoryId)]
        : [categoryId];

      return Object.values(state.resources).filter(
        r => categoryIds.includes(r.categoryId) || (r.subcategoryId && categoryIds.includes(r.subcategoryId))
      );
    },
    [state.resources]
  );

  const getCategoryPath = useCallback((categoryId: string): MindMapCategory[] => {
    const path = getAncestorPath(categoryId);
    return path.map(id => state.mindMap.categories[id]).filter(Boolean);
  }, [state.mindMap.categories]);

  const getCategory = useCallback(
    (categoryId: string): MindMapCategory | undefined => {
      return state.mindMap.categories[categoryId];
    },
    [state.mindMap.categories]
  );

  // ═══════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════════════════════

  const contextValue: WorkshopContextValue = useMemo(
    () => ({
      state,
      selectCategory,
      toggleCategoryExpand,
      expandToCategory,
      setHoveredCategory,
      selectResource,
      addResource,
      updateResource,
      deleteResource,
      bookmarkResource,
      incrementViewCount,
      setHoveredResource,
      setViewMode,
      setSearchQuery,
      setFilters,
      clearFilters,
      setFocusNode,
      setCameraTarget,
      filteredResources,
      resourcesInCategory,
      getCategoryPath,
      getCategory,
    }),
    [
      state,
      selectCategory,
      toggleCategoryExpand,
      expandToCategory,
      setHoveredCategory,
      selectResource,
      addResource,
      updateResource,
      deleteResource,
      bookmarkResource,
      incrementViewCount,
      setHoveredResource,
      setViewMode,
      setSearchQuery,
      setFilters,
      clearFilters,
      setFocusNode,
      setCameraTarget,
      filteredResources,
      resourcesInCategory,
      getCategoryPath,
      getCategory,
    ]
  );

  return (
    <WorkshopContext.Provider value={contextValue}>
      {children}
    </WorkshopContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useWorkshop(): WorkshopContextValue {
  const context = useContext(WorkshopContext);
  if (!context) {
    throw new Error('useWorkshop must be used within a WorkshopProvider');
  }
  return context;
}

export default WorkshopProvider;
