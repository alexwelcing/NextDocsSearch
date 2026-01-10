# NextDocsSearch Improvements & Roadmap

This document outlines identified improvements and technical debt to be addressed to enhance the stability, performance, and maintainability of the NextDocsSearch platform.

## Top 10 Improvements

1.  **Robust MDX Parsing**:
    *   **Issue**: The current MDX processing pipeline is fragile when encountering characters like `<` in text (interpreted as JSX tags), causing build failures.
    *   **Action**: Implement a pre-processing step to escape special characters or configure the MDX loader to be more lenient with text content.

2.  **Component Organization**:
    *   **Issue**: The `components/` directory is flat and contains a mix of 3D, UI, and context components, making navigation difficult.
    *   **Action**: Restructure `components/` into subdirectories like `components/3d`, `components/ui`, `components/contexts`, `components/features` as recommended in `AGENTS.md`.

3.  **Image Optimization**:
    *   **Issue**: While some `img` tags have been replaced with `next/image`, a comprehensive audit is needed to ensure all images (including those in Markdown content if applicable) are optimized.
    *   **Action**: Enforce `next/image` usage via lint rules and optimize `ArticleDisplayPanel` images with placeholders.

4.  **Dependency Management in Hooks**:
    *   **Issue**: Complex `useEffect` hooks (like in `SupabaseDataContext`) often have missing or circular dependencies, leading to potential bugs or infinite loops.
    *   **Action**: Refactor complex hooks into custom hooks with clear inputs/outputs and strict dependency management. Use `useCallback` and `useMemo` consistently.

5.  **Type Safety Enhancements**:
    *   **Issue**: There are instances of `any` types (e.g., in `errors.ts`) and loose typing in some API responses.
    *   **Action**: Enable stricter TypeScript checks (`noImplicitAny`) and define comprehensive types for all API responses and Supabase data structures.

6.  **Testing Strategy Implementation**:
    *   **Issue**: The project lacks a robust automated testing suite, relying mostly on manual verification.
    *   **Action**: Implement unit tests for core logic (e.g., `SupabaseDataContext`, `generate-embeddings.ts`) using Jest/Vitest and integration tests for critical flows.

7.  **Performance Monitoring Integration**:
    *   **Issue**: `PerformanceLogger` exists but isn't fully integrated into the production workflow or analytics.
    *   **Action**: Integrate `PerformanceLogger` with a remote monitoring service (e.g., Vercel Analytics or a custom endpoint) to track client-side performance in production.

8.  **Accessibility (a11y) Audit**:
    *   **Issue**: The 3D nature of the site presents accessibility challenges.
    *   **Action**: Conduct a full a11y audit. Ensure keyboard navigation works for the 3D scene (e.g., tabbing to interactive elements) and that screen readers can access all content in overlays.

9.  **Global Error Handling**:
    *   **Issue**: Error handling is often localized (e.g., `try/catch` in `fetchResponse`).
    *   **Action**: Implement a global Error Boundary component to catch React errors and a centralized error reporting service for API failures.

10. **Documentation Updates**:
    *   **Issue**: `AGENTS.md` is a great resource but needs to be kept in sync with code changes. API documentation is sparse.
    *   **Action**: Automatically generate API documentation where possible and establish a process to update `AGENTS.md` when architecture changes.

## Documentation

### Project Structure
Refer to `AGENTS.md` for a detailed architectural overview.

### Contributing
1.  **Validation**: Run `pnpm run validate` to check for linting and type errors. This is the recommended check before pushing code.
2.  **Type Checking**: Run `pnpm run type-check` to strictly check TypeScript types without building.
3.  **Linting**: Ensure `pnpm lint` passes.
4.  **Build**: Run `pnpm build` locally to catch build-time errors (like MDX issues).
5.  **Conventions**: Follow the existing patterns for 3D components (R3F) and styling (Styled Components).

### Deployment
The project is deployed on Vercel. Ensure all environment variables are set in the Vercel dashboard.
