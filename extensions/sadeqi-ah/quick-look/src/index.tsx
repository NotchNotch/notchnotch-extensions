import { DropTypes, DropZone, files, type DropItem } from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

/** Previews what you drop in Quick Look. Nothing is kept, so there's nothing to show in Home. */
function QuickLook() {
  async function preview(items: DropItem[]) {
    const dropped = items.flatMap((item) => item.kind === "file" ? [item.file] : []);
    if (!dropped.length) return;
    // The drop counts as a click, so the app lets this through.
    try { await files.preview(dropped); }
    catch (error) { console.error(error); }
    finally { await files.release(dropped).catch(() => {}); }
  }
  return <DropZone id="preview" title="Quick Look" icon="eye" accepts={[DropTypes.files, "public.directory"]} multiple
    onDrop={(items) => void preview(items)} />;
}

start(<QuickLook />);
