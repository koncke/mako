import { useEffect, useState } from "react";
import { useCommittedRef } from "@/app/video-editor/_opencut/hooks/use-committed-ref";
import { useSelectionContext } from "@/app/video-editor/_opencut/selection/context";
import { activateScope, type ScopeEntry } from "@/app/video-editor/_opencut/selection/scope";

export function useSelectionScope() {
	const { selectedIds, clearSelection } = useSelectionContext();
	const hasSelection = selectedIds.length > 0;
	const hasSelectionRef = useCommittedRef(hasSelection);
	const clearSelectionRef = useCommittedRef(clearSelection);
	const [entry] = useState<ScopeEntry>(() => ({
		hasSelection: () => hasSelectionRef.current,
		clear: () => {
			clearSelectionRef.current();
		},
	}));

	useEffect(() => {
		if (!hasSelection) {
			return;
		}

		return activateScope({ entry });
	}, [entry, hasSelection]);
}
