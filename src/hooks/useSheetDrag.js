import { useState, useRef } from "react";

// Swipe-down-to-dismiss for a bottom sheet (block 8, part C's grab handle
// needs to actually do something). Returns props for the draggable zone
// (the grab handle + header, not the whole sheet — see call sites in
// MatchView.jsx/SquadSettingsForm.jsx) and a style to spread onto the
// sheet's own root element. Pixels past DISMISS_THRESHOLD_PX on release
// dismiss; anything less snaps back.
//
// Originally local to MatchView.jsx (its player-tap/injury sheets) —
// extracted here once SquadSettingsForm's own "rebuild rotation" confirm
// sheet needed the identical behavior (real-use feedback: it looked like
// every other bottom sheet in the app but didn't swipe-dismiss like one).
const DISMISS_THRESHOLD_PX = 90;
export function useSheetDrag(onDismiss) {
  const [dragY, setDragY] = useState(0);
  const dragState = useRef({ dragging: false, startY: 0 }).current;

  const onPointerDown = (e) => {
    dragState.dragging = true;
    dragState.startY = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragState.dragging) return;
    const delta = e.clientY - dragState.startY;
    if (delta > 0) setDragY(delta); // ignore upward drags — nothing to reveal above bottom:0
  };
  const endDrag = () => {
    if (!dragState.dragging) return;
    dragState.dragging = false;
    if (dragY > DISMISS_THRESHOLD_PX) onDismiss();
    setDragY(0);
  };

  return {
    dragHandleProps: {
      onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag,
      style: { touchAction: "none", cursor: "grab" },
    },
    // Always a concrete transform (not just while dragY > 0) so releasing
    // short of the threshold animates smoothly back to translateY(0)
    // instead of snapping — the transition is only suppressed while a
    // drag is actually in progress, so the sheet tracks the finger
    // without lag.
    dragStyle: { transform: `translateY(${dragY}px)`, transition: dragState.dragging ? "none" : "transform 0.2s ease" },
  };
}
