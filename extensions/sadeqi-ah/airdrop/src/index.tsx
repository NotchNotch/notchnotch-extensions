import { DropTypes, DropZone, files, type DropItem } from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

/** Sends what you drop straight to AirDrop. Nothing is kept, so there's nothing to show in Home. */
function Airdrop() {
  async function send(items: DropItem[]) {
    const dropped = items.flatMap((item) => item.kind === "file" ? [item.file] : []);
    if (!dropped.length) return;
    // The drop counts as a click, so the app lets this through.
    try { await files.airDrop(dropped); }
    catch (error) { console.error(error); }
    finally { await files.release(dropped).catch(() => {}); }
  }
  return <DropZone id="send" title="AirDrop" icon="dot.radiowaves.left.and.right" accepts={[DropTypes.files, "public.directory"]} multiple
    onDrop={(items) => void send(items)} />;
}

start(<Airdrop />);
