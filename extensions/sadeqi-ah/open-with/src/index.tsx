import { DropTypes, DropZone, files, type DropItem } from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

/** Shows the apps that open what you drop, beside the pointer. Nothing is kept, so there's nothing to show in Home. */
function OpenWith() {
  async function open(items: DropItem[]) {
    const dropped = items.flatMap((item) => item.kind === "file" ? [item.file] : []);
    if (!dropped.length) return;
    // The drop counts as a click, so the app lets this through.
    try { await files.openWith(dropped); }
    catch (error) { console.error(error); }
    finally { await files.release(dropped).catch(() => {}); }
  }
  return <DropZone id="open" title="Open With" icon="arrow.up.forward.app" accepts={[DropTypes.files, "public.directory"]} multiple
    onDrop={(items) => void open(items)} />;
}

start(<OpenWith />);
