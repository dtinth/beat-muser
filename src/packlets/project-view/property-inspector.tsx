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
  $currentPropertyValues,
  setPropertyValue,
} from "../editor-core/index.ts";
import type { PropertyDefinition } from "../extensions/index.ts";

const MULTIPLE = Symbol("multiple");

function getControlValue(
  propKey: string,
  def: PropertyDefinition,
  currentValues: Record<string, unknown>,
  entityComponents: unknown[],
): unknown | typeof MULTIPLE {
  const defaultVal = propKey in currentValues ? currentValues[propKey] : def.default;
  if (entityComponents.length === 0) return defaultVal;
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
  value: unknown | typeof MULTIPLE;
  onChange: (value: unknown) => void;
}) {
  const control = def.ui?.control ?? "text";

  if (control === "segmented" && def.ui?.options) {
    return (
      <Flex style={{ gap: 2 }}>
        {def.ui.options.map((opt) => {
          const isActive = value !== MULTIPLE && value === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
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
    const numVal = value === MULTIPLE ? (min as number) : (Number(value) ?? 0);
    return (
      <Flex align="center" style={{ gap: 6 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numVal}
          onChange={(e) => onChange(Number(e.target.value))}
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
        value={value === MULTIPLE ? "" : String(value ?? "")}
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
        value={value === MULTIPLE ? "" : String(value ?? 0)}
        onChange={(e) => onChange(Number(e.target.value))}
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
      value={value === MULTIPLE ? "" : String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
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
  const currentValues = useStore($currentPropertyValues);

  // Get selected level's game mode
  const em = controller.getEntityManager();
  const levelEntity = selectedLevelId ? em.get(selectedLevelId) : undefined;
  const levelComponent = levelEntity ? em.getComponent(levelEntity, LEVEL) : undefined;
  const mode = levelComponent?.mode;

  // Get property sets for this game mode
  const registry = controller.ctx.get(GameModeRegistrySlice);
  const propertySets = mode ? registry.getPropertySetsForMode(mode) : [];

  // Filter selected entities to those in the active level
  const selectedEntities = [...selection]
    .map((id) => em.get(id))
    .filter((e): e is NonNullable<typeof e> => {
      if (!e) return false;
      const lr = em.getComponent(e, LEVEL_REF);
      return lr?.levelId === selectedLevelId;
    });

  const handleChange = (propKey: string, def: PropertyDefinition, value: unknown) => {
    setPropertyValue(propKey, value);

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

  if (!mode) {
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
            const entityComponents = selectedEntities.map((e) => e.components[def.component]);
            const value = getControlValue(propKey, def, currentValues, entityComponents);
            return (
              <Flex key={propKey} direction="column" style={{ gap: 2 }}>
                <Text size="1" color="gray">
                  {def.label}
                </Text>
                <PropertyControl
                  def={def}
                  value={value}
                  onChange={(v) => handleChange(propKey, def, v)}
                />
              </Flex>
            );
          })}
        </Flex>
      ))}
    </Flex>
  );
}
