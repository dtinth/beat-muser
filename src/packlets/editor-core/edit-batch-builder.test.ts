import { describe, expect, test } from "vite-plus/test";
import { EntityManager, entity } from "../entity-manager/index.ts";
import { EVENT, NOTE, LEVEL_REF, SOUND_EVENT, KEYSOUND } from "./components.ts";
import { EditBatchBuilder } from "./edit-batch-builder.ts";

function makeEm() {
  return new EntityManager();
}

describe("EditBatchBuilder", () => {
  test("setPulse creates a pulse-only edit", () => {
    const em = makeEm();
    const e = entity((b) => b.with(EVENT, { y: 500 }).with(NOTE, { lane: 1 }));
    em.insert(e);

    const batch = new EditBatchBuilder(em);
    batch.setPulse(e.id, 300);
    const edits = batch.build();

    expect(edits).toHaveLength(1);
    expect(edits[0].entityId).toBe(e.id);
    expect((edits[0].oldComponents[EVENT.key] as { y: number }).y).toBe(500);
    expect((edits[0].newComponents[EVENT.key] as { y: number }).y).toBe(300);
    expect((edits[0].newComponents[NOTE.key] as { lane: number }).lane).toBe(1);
  });

  test("setNoteColumn updates lane and level", () => {
    const em = makeEm();
    const e = entity((b) =>
      b.with(EVENT, { y: 500 }).with(NOTE, { lane: 1 }).with(LEVEL_REF, { levelId: "l1" }),
    );
    em.insert(e);

    const batch = new EditBatchBuilder(em);
    batch.setNoteColumn(e.id, "l2", 3);
    const edits = batch.build();

    const nc = edits[0].newComponents;
    expect((nc[NOTE.key] as { lane: number }).lane).toBe(3);
    expect((nc[LEVEL_REF.key] as { levelId: string }).levelId).toBe("l2");
  });

  test("setSoundLane updates sound lane", () => {
    const em = makeEm();
    const e = entity((b) =>
      b
        .with(EVENT, { y: 500 })
        .with(SOUND_EVENT, { soundLane: 0, soundChannelId: "ch", command: "play" }),
    );
    em.insert(e);

    const batch = new EditBatchBuilder(em);
    batch.setSoundLane(e.id, 2);
    const edits = batch.build();

    expect((edits[0].newComponents[SOUND_EVENT.key] as { soundLane: number }).soundLane).toBe(2);
  });

  test("multiple mutations on same entity merge into single edit", () => {
    const em = makeEm();
    const e = entity((b) =>
      b.with(EVENT, { y: 500 }).with(NOTE, { lane: 1 }).with(LEVEL_REF, { levelId: "l1" }),
    );
    em.insert(e);

    const batch = new EditBatchBuilder(em);
    batch.setPulse(e.id, 300);
    batch.setNoteColumn(e.id, "l2", 3);
    const edits = batch.build();

    expect(edits).toHaveLength(1);
    const nc = edits[0].newComponents;
    expect((nc[EVENT.key] as { y: number }).y).toBe(300);
    expect((nc[NOTE.key] as { lane: number }).lane).toBe(3);
    expect((nc[LEVEL_REF.key] as { levelId: string }).levelId).toBe("l2");
  });

  test("oldComponents captures state before any mutation", () => {
    const em = makeEm();
    const e = entity((b) =>
      b.with(EVENT, { y: 500 }).with(NOTE, { lane: 1 }).with(LEVEL_REF, { levelId: "l1" }),
    );
    em.insert(e);

    const batch = new EditBatchBuilder(em);
    batch.setPulse(e.id, 300);
    batch.setNoteColumn(e.id, "l2", 5);
    const edits = batch.build();

    const oc = edits[0].oldComponents;
    expect((oc[EVENT.key] as { y: number }).y).toBe(500);
    expect((oc[NOTE.key] as { lane: number }).lane).toBe(1);
    expect((oc[LEVEL_REF.key] as { levelId: string }).levelId).toBe("l1");
  });

  test("setKeysoundLane updates KEYSOUND component", () => {
    const em = makeEm();
    const e = entity((b) => b.with(EVENT, { y: 500 }).with(KEYSOUND, { soundLane: 0 }));
    em.insert(e);

    const batch = new EditBatchBuilder(em);
    batch.setKeysoundLane(e.id, 2);
    const edits = batch.build();

    expect((edits[0].newComponents[KEYSOUND.key] as { soundLane: number }).soundLane).toBe(2);
  });

  test("getModifiedEntityIds returns set of touched entities", () => {
    const em = makeEm();
    const e1 = entity((b) => b.with(EVENT, { y: 100 }));
    const e2 = entity((b) => b.with(EVENT, { y: 200 }));
    em.insert(e1);
    em.insert(e2);

    const batch = new EditBatchBuilder(em);
    batch.setPulse(e1.id, 50);
    expect(batch.getModifiedEntityIds()).toEqual(new Set([e1.id]));
  });
});
