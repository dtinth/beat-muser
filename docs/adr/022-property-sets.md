# ADR 022: Property Sets for Extension Note Attributes

**Status:** Accepted

Extensions need to declare editable note attributes (component fields) that appear in the property inspector and are injected into new entities during placement. Rather than routing every property edit through a Web Worker, the editor provides a synchronous, declarative property system. Each game mode references property sets by ID. Each property set defines which entity component keys are editable, with defaults and UI hints. The editor tracks "sticky" current values per property key — seeded from defaults, overwritten by user edits in the inspector, and applied to newly placed gameplay entities. Future worker commands (ADR 020) will route through `applyProperty` on the host, but the property system itself is native to the editor.
