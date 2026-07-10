/**
 * @packageDocumentation
 *
 * Property inspector panel for editing extension-declared note attributes.
 * Displays controls for each property in the active game mode's property set.
 * Changes apply to selected entities and update current property values.
 */

import { useStore } from "@nanostores/react";
import { Flex, Text } from "@radix-ui/themes";
import {
  EditorController,
  GameModeRegistrySlice,
  SelectionSlice,
  LEVEL_REF,
  LEVEL,
  BatchEditEntitiesUserAction,
} from "../editor-core/index.ts";
import type { PropertyDefinition } from "../extensions/index.ts";

const MULTIPLE = Symbol("multiple");

function toDisplayString(value: unknown, fallback = ""): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function getControlValue(
  _propKey: string,
  def: PropertyDefinition,
  entityComponents: unknown[],
): unknown {
  if (entityComponents.length === 0) return def.default;
  const first = entityComponents[0];
  for (const c of entityComponents) {
    if (c !== first) return MULTIPLE;
  }
  return first;
}

function PropertyControl({
  def,
  value,
  onChange,
}: {
  def: PropertyDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const control = def.ui?.control ?? "text";

  if (control === "segmented" && def.ui?.options) {
    return (
      <Flex style={{ gap: 2 }} wrap="wrap">
        {def.ui.options.map((opt) => {
          const isActive = value !== MULTIPLE && value === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => {
                onChange(opt.value);
              }}
              style={{
                padding: "3px 10px",
                fontSize: 11,
                cursor: "pointer",
                border: isActive ? "1px solid var(--accent-8)" : "1px solid var(--gray-5)",
                borderRadius: 4,
                background: isActive ? "var(--accent-3)" : "transparent",
                color: isActive ? "var(--accent-11)" : "var(--gray-11)",
                fontFamily: "inherit",
                lineHeight: 1.2,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </Flex>
    );
  }

  if (control === "slider") {
    const min = def.ui?.min ?? 0;
    const max = def.ui?.max ?? 1;
    const step = def.ui?.step ?? 0.01;
    const rawNumVal = value === MULTIPLE ? min : Number(value);
    const numVal = Number.isFinite(rawNumVal) ? rawNumVal : min;
    return (
      <Flex align="center" style={{ gap: 6 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numVal}
          onChange={(e) => {
            onChange(Number(e.target.value));
          }}
          style={{ flex: 1, accentColor: "var(--accent-9)" }}
        />
        <Text
          size="1"
          style={{
            minWidth: 30,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value === MULTIPLE ? "—" : numVal.toFixed(step < 1 ? 2 : 0)}
        </Text>
      </Flex>
    );
  }

  if (control === "select" && def.ui?.options) {
    return (
      <select
        value={value === MULTIPLE ? "" : toDisplayString(value)}
        onChange={(e) => {
          const opt = def.ui?.options?.find((o) => String(o.value) === e.target.value);
          if (opt) onChange(opt.value);
        }}
        style={{
          width: "100%",
          padding: "3px 6px",
          fontSize: 11,
          border: "1px solid var(--gray-5)",
          borderRadius: 4,
          background: "var(--gray-1)",
          color: "var(--gray-12)",
          fontFamily: "inherit",
        }}
      >
        {value === MULTIPLE && <option value="">(multiple)</option>}
        {def.ui.options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (control === "number") {
    return (
      <input
        type="number"
        value={value === MULTIPLE ? "" : toDisplayString(value, "0")}
        onChange={(e) => {
          const sanitized = Number(e.target.value);
          if (Number.isNaN(sanitized) || !Number.isFinite(sanitized)) return;
          onChange(sanitized);
        }}
        placeholder={value === MULTIPLE ? "(multiple)" : undefined}
        style={{
          width: "100%",
          padding: "3px 6px",
          fontSize: 11,
          border: "1px solid var(--gray-5)",
          borderRadius: 4,
          background: "var(--gray-1)",
          color: "var(--gray-12)",
          fontFamily: "inherit",
          boxSizing: "border-box",
        }}
      />
    );
  }

  return (
    <input
      type="text"
      value={value === MULTIPLE ? "" : toDisplayString(value)}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      placeholder={value === MULTIPLE ? "(multiple)" : undefined}
      style={{
        width: "100%",
        padding: "3px 6px",
        fontSize: 11,
        border: "1px solid var(--gray-5)",
        borderRadius: 4,
        background: "var(--gray-1)",
        color: "var(--gray-12)",
        fontFamily: "inherit",
        boxSizing: "border-box",
      }}
    />
  );
}

export function PropertyInspector({ controller }: { controller: EditorController }) {
  const selectedLevelId = useStore(controller.$selectedLevelId);
  const selection = useStore(controller.ctx.get(SelectionSlice).$selection);
  useStore(controller.getEntityManager().$mutationVersion);

  // Get selected level's game mode
  const em = controller.getEntityManager();
  const levelEntity =
    selectedLevelId !== null && selectedLevelId !== "" ? em.get(selectedLevelId) : undefined;
  const levelComponent = levelEntity ? em.getComponent(levelEntity, LEVEL) : undefined;
  const mode = levelComponent?.mode;

  // Get property sets for this game mode
  const registry = controller.ctx.get(GameModeRegistrySlice);
  const propertySets =
    mode !== undefined && mode !== "" ? registry.getPropertySetsForMode(mode) : [];

  // Filter selected entities to those in the active level
  const selectedEntities = [...selection]
    .map((id) => em.get(id))
    .filter((e): e is NonNullable<typeof e> => {
      if (!e) return false;
      const lr = em.getComponent(e, LEVEL_REF);
      return lr?.levelId === selectedLevelId;
    });

  const handleChange = (_propKey: string, def: PropertyDefinition, value: unknown) => {
    if (selectedEntities.length === 0) return;

    const edits = selectedEntities.map((e) => ({
      entityId: e.id,
      oldComponents: structuredClone(e.components),
      newComponents: {
        ...e.components,
        [def.component]: value,
      },
    }));
    controller.applyAction(new BatchEditEntitiesUserAction(controller.ctx, edits));
  };

  if (mode === undefined || mode === "") {
    return (
      <Text size="1" color="gray">
        Select a level to view properties
      </Text>
    );
  }

  if (propertySets.length === 0) {
    return (
      <Text size="1" color="gray">
        No editable properties for this game mode
      </Text>
    );
  }

  return (
    <Flex direction="column" style={{ gap: 8 }}>
      {propertySets.map((ps) => (
        <Flex key={ps.label} direction="column" style={{ gap: 6 }}>
          <Text size="1" weight="bold" color="gray">
            {ps.label}
          </Text>
          {Object.entries(ps.properties).map(([propKey, def]) => {
            const entityComponents = selectedEntities.map(
              (e): unknown => e.components[def.component],
            );
            const value = getControlValue(propKey, def, entityComponents);
            return (
              <Flex key={propKey} direction="column" style={{ gap: 2 }}>
                <Text size="1" color="gray">
                  {def.label}
                </Text>
                <PropertyControl
                  def={def}
                  value={value}
                  onChange={(v) => {
                    handleChange(propKey, def, v);
                  }}
                />
              </Flex>
            );
          })}
        </Flex>
      ))}
    </Flex>
  );
}
