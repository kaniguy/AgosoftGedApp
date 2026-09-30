import { cssZoomOf } from "../../../utils/appZoom";

export const PLAN_GEO_TREE_SCROLL_ID = "plan-geo-tree-scroll";

export function scrollPlanNodeIntoView(nodeId, containerId = PLAN_GEO_TREE_SCROLL_ID) {
  const el = document.getElementById(`plan-node-${nodeId}`);
  if (!el) return false;

  const container = document.getElementById(containerId);
  if (!container) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }

  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const zoom = cssZoomOf(container);
  const relativeTop = (elRect.top - containerRect.top) / zoom + container.scrollTop;
  const targetScroll = relativeTop - container.clientHeight / 2 + elRect.height / zoom / 2;

  container.scrollTo({
    top: Math.max(0, targetScroll),
    behavior: "smooth",
  });
  return true;
}
