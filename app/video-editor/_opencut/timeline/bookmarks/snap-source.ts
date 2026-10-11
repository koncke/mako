import type { Bookmark } from "@/app/video-editor/_opencut/timeline";
import type { SnapPoint } from "@/app/video-editor/_opencut/timeline/snapping";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";

export function getBookmarkSnapPoints({
	bookmarks,
	excludeBookmarkTime,
}: {
	bookmarks: Bookmark[];
	excludeBookmarkTime?: MediaTime;
}): SnapPoint[] {
	return bookmarks.flatMap((bookmark) => {
		if (excludeBookmarkTime != null && bookmark.time === excludeBookmarkTime) {
			return [];
		}

		return [
			{ time: bookmark.time, type: "bookmark" satisfies SnapPoint["type"] },
		];
	});
}
