# BrandPilot UI/UX Pro Plan

## Document Control
- Product: BrandPilot
- Scope: Web app + Mobile app (Capacitor) + Admin panel
- Objective: Build a reusable, high-quality design system and implementation model that scales
- Audience: Product, design, frontend engineers, QA, platform owners
- Date: 2026-08-01

## 1. Vision and Outcomes

BrandPilot should feel consistent, premium, and fast across all surfaces. The UI should not be a set of pages; it should be a system. Every visual choice, interaction pattern, and layout behavior should be reusable, measurable, and accessible.

### Success outcomes
- One reusable component system shared by web and mobile app surfaces.
- Consistent UX language across user app and admin panel.
- Faster page delivery through composition, not one-off implementations.
- Lower defect rate through stronger states, accessibility, and test coverage.

## 2. Design Principles

1. Clarity first
- Users should understand where they are, what they can do, and what changed.

2. Consistency with purpose
- Same problem, same interaction. Variance only when context requires it.

3. Progressive disclosure
- Show essentials first, reveal advanced controls when needed.

4. Performance is UX
- Perceived speed is part of design quality. Loading, empty, and failure states are mandatory.

5. Mobile reality
- Touch-first targets, safe-area awareness, keyboard-safe forms, reduced cognitive load.

6. Accessibility by default
- Keyboard support, semantic structure, focus visibility, and contrast are baseline requirements.

## 3. Information Architecture and Navigation Model

### User app IA
- Home
- Frames
- Generate
- History
- Projects
- Wallet
- Settings

### Admin IA
- Dashboard
- Users
- Frames
- Categories
- Wallet Ops
- Recharge Plans
- Subscriptions
- Notifications
- Jobs
- Audit
- Tenants
- AI Config
- System Config

### Navigation rules
- Primary nav should remain stable across sessions.
- Route labels must be task-oriented, not implementation-oriented.
- Every major page must include:
  - primary action
  - filter/search context
  - empty state guidance

## 4. Reusable UI Architecture

### Target package structure
- `packages/design-tokens`
- `packages/ui`
- `packages/features`

### Responsibilities
- `design-tokens`: color, spacing, radius, typography, elevation, motion, z-index, breakpoints.
- `ui`: primitives + composed UI components; no business logic.
- `features`: domain-level hooks, view models, schemas, and composed feature blocks.

### Rule of ownership
- No app-level duplicate primitives.
- If a component appears in 2 places, it belongs in `packages/ui`.

## 5. Design Token System

### Token layers
1. Core tokens
- spacing scale, border radius, font sizes, line heights, shadow levels

2. Semantic tokens
- `surface.primary`, `surface.elevated`, `text.primary`, `text.muted`, `border.default`, `state.success`, `state.warning`, `state.danger`

3. Component tokens
- `button.*`, `input.*`, `card.*`, `table.*`, `badge.*`

### Theme strategy
- Global default theme for BrandPilot
- Tenant override layer for branding
- High contrast mode support

### Token governance
- No raw hex values in app screens.
- No hardcoded spacing beyond token map.

## 6. Component Inventory and Build Priority

### Tier 1: Foundational primitives
- Button
- IconButton
- Input
- Textarea
- Select
- Checkbox
- Radio
- Switch
- Badge
- Chip
- Tooltip
- Spinner
- Skeleton

### Tier 2: Structure and feedback
- Card
- Panel
- Dialog
- Drawer
- Tabs
- Toast
- Alert
- EmptyState
- ErrorState

### Tier 3: Data-heavy reusable blocks
- DataTable
- TableToolbar
- Pagination
- FilterBar
- SearchField
- SortControl
- StatusPill

### Tier 4: Domain reusable components
- FrameCard
- PlanCard
- SubscriptionStatusCard
- WalletSummaryCard
- TransactionRow
- JobStatusTimeline
- NotificationPreferenceGroup

## 7. Layout and Responsive System

### Layout primitives
- AppShell
- Container
- Stack
- Inline
- Grid
- SectionHeader

### Responsive behavior
- Mobile-first breakpoints.
- Content density modes for desktop-heavy admin tables.
- Collapse secondary actions into overflow menu on narrow widths.

### Mobile-specific constraints
- Minimum 44px touch target.
- Bottom sheet for action-heavy modal flows.
- Sticky action bars for long forms.

## 8. Interaction and Motion Standards

### Motion principles
- Motion explains hierarchy and state changes.
- Keep durations short and purposeful.
- Respect `prefers-reduced-motion`.

### Standard transitions
- Page content reveal
- Modal open/close
- Toast enter/exit
- Skeleton-to-content handoff

### Feedback expectations
- Immediate visual response on click/tap.
- Clear disabled/loading/success/error states for every action.

## 9. Page-Level UX Patterns

### Dashboard pages
- KPI strip, then trend blocks, then actionable queues.
- Every KPI card should drill down.

### CRUD list pages
- Header with title + primary CTA
- Filter/search row
- Data table
- Empty state with action

### Form pages
- Group fields into sections
- Inline validation
- Unsaved changes protection
- Sticky save actions on long forms

### Async jobs and generation
- Explicit state machine in UI: queued, running, succeeded, failed
- Retry with clear reason when failed
- Optimistic queued state before backend confirm

## 10. Accessibility and Inclusivity Checklist

### Required for every component
- Keyboard navigation
- Focus ring visible and consistent
- Semantic labels and role attributes
- Error messages linked to fields
- Color contrast AA minimum

### Required for every page
- Heading hierarchy
- Skip-to-content support
- Landmarks (`header`, `main`, `nav`, `aside`)

## 11. Content and Microcopy Guidelines

- Use action verbs on CTAs: "Save Plan", "Retry Job", "Start Subscription".
- Error copy must include:
  - what failed
  - what to do next
- Status labels should be short and consistent across app and admin.
- Avoid internal technical terms unless in admin advanced context.

## 12. Implementation Roadmap

### Phase 1 (2 weeks): Foundation
- Create `packages/design-tokens` and `packages/ui`.
- Implement token pipeline and Tier 1 primitives.
- Add Storybook (or equivalent) for visual catalog.

### Phase 2 (2-3 weeks): Core experience migration
- Migrate user app high-traffic screens:
  - Frames
  - Generate
  - Wallet
  - Settings
- Replace local repeated styles/components with shared package.

### Phase 3 (2-3 weeks): Admin migration
- Migrate admin tables/forms/panels to shared composed blocks.
- Standardize status indicators and table actions.

### Phase 4 (1-2 weeks): Hardening
- Visual regression coverage for core components.
- Accessibility audit and fixes.
- Performance polish on mobile flows.

## 13. Engineering Quality Gates

### Pull request gates
- New UI work must use shared components where available.
- No hardcoded colors or spacing outside tokens.
- Required states: default, hover/focus, disabled, loading, error.

### Automated checks
- Typecheck
- Lint
- Component tests
- Accessibility checks for key screens
- Visual snapshot checks for Tier 1 and Tier 2 components

## 14. Metrics and KPIs

### Delivery KPIs
- Component reuse ratio: percentage of UI imported from `packages/ui`.
- Time to ship new page section after migration baseline.

### Experience KPIs
- UI-related defect rate per release.
- Core task completion rate (generate asset, recharge, manage plan).
- Perceived speed score via UX survey pulse.

### Accessibility KPIs
- Number of a11y violations in CI over time.
- Keyboard-only completion of top 5 workflows.

## 15. Immediate Task Backlog (Execution Starter)

1. Create workspace packages:
- `packages/design-tokens`
- `packages/ui`

2. Publish first token set:
- color semantic tokens
- spacing scale
- typography scale

3. Build first 12 primitives:
- Button, Input, Select, Textarea, Checkbox, Switch, Card, Badge, Dialog, Tabs, Skeleton, Toast

4. Migrate one user page and one admin page:
- user: Generate page
- admin: Subscriptions page

5. Add docs:
- usage examples
- do/don't patterns
- migration cookbook

## 16. Risks and Mitigations

### Risk: Team continues building local one-off components
- Mitigation: enforce lint/check rule and PR checklist for shared usage.

### Risk: Web and mobile needs diverge
- Mitigation: keep primitives platform-agnostic and isolate only adapter-level differences.

### Risk: Migration slows feature work
- Mitigation: migrate by page slices and prioritize high-churn screens first.

## 17. Definition of Done for the UI System

The UI system is considered production-ready when all of the following are true:
- Shared token system is used by web and mobile surfaces.
- Tier 1 and Tier 2 components are fully reusable and documented.
- High-traffic app/admin screens use shared components.
- Accessibility and visual checks run in CI.
- New UI features can be built without introducing app-local primitives.

---

This plan is intentionally execution-first: it can be translated directly into tickets and sprint milestones with minimal interpretation.
