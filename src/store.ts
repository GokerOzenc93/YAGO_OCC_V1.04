import { create } from 'zustand'
import * as THREE from 'three'
import type { OpenCascadeInstance } from './vite-env'
import { VertexModification } from './components/VertexEditorService'

// --- Utility Helpers ---
const setVal = (set, key) => value => set({ [key]: value })
const toggle = (set, key) => () => set(state => ({ [key]: !state[key] }))
const mergeState = (state, path, value) => {
  const parts = path.split('.')
  const last = parts.pop()
  let obj = state
  for (const p of parts) obj = obj[p]
  obj[last] = value
  return { ...state }
}

// --- Panel Value + Show Flags Automator ---
const generatePanelStates = (set, keys) => {
  const out = {}
  for (const k of keys) {
    const showKey = 'show' + k[0].toUpperCase() + k.slice(1)
    out[k] = 0
    out[showKey] = false
    out['set' + k[0].toUpperCase() + k.slice(1)] = setVal(set, k)
    out['set' + showKey[0].toUpperCase() + showKey.slice(1)] = setVal(set, showKey)
  }
  return out
}

// Panel keys to auto-generate
const panelKeys = [
  'backPanelLeftExtend',
  'backPanelRightExtend',
  'backPanelTopExtend',
  'backPanelBottomExtend',
  'leftPanelBackShorten',
  'rightPanelBackShorten',
  'topPanelBackShorten',
  'bottomPanelBackShorten'
]

// --- Base Store ---
export const useAppStore = create((set, get) => {

  const panelStates = generatePanelStates(set, panelKeys)

  return {

    // Shapes
    shapes: [],
    addShape: shape => set(state => ({ shapes: [...state.shapes, shape] })),

    // Simple UI States
    showParametersPanel: false,
    showOutlines: true,
    showRoleNumbers: false,
    panelSelectMode: false,
    panelSurfaceSelectMode: false,
    showGlobalSettingsPanel: false,
    faceEditMode: false,
    filletMode: false,
    roleEditMode: false,
    raycastMode: false,
    showVirtualFaces: true,

    // Selected + hovered
    selectedPanelRow: null,
    selectedPanelRowExtraId: null,
    selectedFaceIndex: null,
    hoveredFaceIndex: null,

    // Fillets
    selectedFilletFaces: [],
    selectedFilletFaceData: [],

    // Raycast
    raycastResults: [],

    // Virtual Faces
    virtualFaces: [],

    // Panel / Base / Leg settings
    bazaHeight: 100,
    frontBaseDistance: 10,
    backBaseDistance: 30,
    legHeight: 100,
    legDiameter: 25,
    legFrontDistance: 30,
    legBackDistance: 30,
    legSideDistance: 30,

    // Selections
    isLeftPanelSelected: false,
    isRightPanelSelected: false,
    isTopPanelSelected: false,
    isBottomPanelSelected: false,

    // Tools
    activeTool: 'Select',
    lastTransformTool: 'Select',

    // Camera / View
    cameraType: 'perspective',
    viewMode: 'solid',
    orthoMode: 'off',

    // Misc
    waitingForSurfaceSelection: null,
    pendingPanelCreation: null,
    pointToPointMoveState: null,
    opencascadeInstance: null,
    opencascadeLoading: false,
    vertexEditMode: false,
    selectedVertexIndex: null,
    vertexDirection: null,
    subtractionViewMode: false,
    selectedSubtractionIndex: null,
    hoveredSubtractionIndex: null,

    // Snap
    snapSettings: {
      endpoint: false,
      midpoint: false,
      center: false,
      perpendicular: false,
      intersection: false,
      nearest: false
    },

    // Auto‑generated panel states
    ...panelStates,

    // Generic Setters
    setShowParametersPanel: setVal(set, 'showParametersPanel'),
    setShowOutlines: setVal(set, 'showOutlines'),
    setShowRoleNumbers: setVal(set, 'showRoleNumbers'),
    setPanelSelectMode: setVal(set, 'panelSelectMode'),
    setPanelSurfaceSelectMode: setVal(set, 'panelSurfaceSelectMode'),
    setShowGlobalSettingsPanel: setVal(set, 'showGlobalSettingsPanel'),
    setFaceEditMode: setVal(set, 'faceEditMode'),
    setRoleEditMode: setVal(set, 'roleEditMode'),
    setRaycastMode: setVal(set, 'raycastMode'),
    setShowVirtualFaces: setVal(set, 'showVirtualFaces'),
    setSelectedPanelRow: (index, extra) =>
      set({ selectedPanelRow: index, selectedPanelRowExtraId: extra || null }),
    setSelectedFaceIndex: setVal(set, 'selectedFaceIndex'),
    setHoveredFaceIndex: setVal(set, 'hoveredFaceIndex'),
    setSelectedFilletFaces: setVal(set, 'selectedFilletFaces'),
    setSelectedFilletFaceData: setVal(set, 'selectedFilletFaceData'),
    setRaycastResults: setVal(set, 'raycastResults'),
    setBazaHeight: setVal(set, 'bazaHeight'),
    setFrontBaseDistance: setVal(set, 'frontBaseDistance'),
    setBackBaseDistance: setVal(set, 'backBaseDistance'),
    setLegHeight: setVal(set, 'legHeight'),
    setLegDiameter: setVal(set, 'legDiameter'),
    setLegFrontDistance: setVal(set, 'legFrontDistance'),
    setLegBackDistance: setVal(set, 'legBackDistance'),
    setLegSideDistance: setVal(set, 'legSideDistance'),
    setIsLeftPanelSelected: setVal(set, 'isLeftPanelSelected'),
    setIsRightPanelSelected: setVal(set, 'isRightPanelSelected'),
    setIsTopPanelSelected: setVal(set, 'isTopPanelSelected'),
    setIsBottomPanelSelected: setVal(set, 'isBottomPanelSelected'),
    setActiveTool: setVal(set, 'activeTool'),
    setLastTransformTool: setVal(set, 'lastTransformTool'),
    setCameraType: setVal(set, 'cameraType'),
    setViewMode: setVal(set, 'viewMode'),
    setWaitingForSurfaceSelection: setVal(set, 'waitingForSurfaceSelection'),
    setPendingPanelCreation: setVal(set, 'pendingPanelCreation'),
    setPointToPointMoveState: setVal(set, 'pointToPointMoveState'),
    setOpenCascadeInstance: setVal(set, 'opencascadeInstance'),
    setOpenCascadeLoading: setVal(set, 'opencascadeLoading'),
    setVertexEditMode: setVal(set, 'vertexEditMode'),
    setSelectedVertexIndex: setVal(set, 'selectedVertexIndex'),
    setVertexDirection: setVal(set, 'vertexDirection'),
    setSubtractionViewMode: setVal(set, 'subtractionViewMode'),
    setSelectedSubtractionIndex: setVal(set, 'selectedSubtractionIndex'),
    setHoveredSubtractionIndex: setVal(set, 'hoveredSubtractionIndex'),

    toggleOrthoMode: () =>
      set(state => ({ orthoMode: state.orthoMode === 'on' ? 'off' : 'on' })),

    toggleSnapSetting: type =>
      set(state => ({
        snapSettings: {
          ...state.snapSettings,
          [type]: !state.snapSettings[type]
        }
      })),

    cycleViewMode: () => {
      const order = ['solid', 'wireframe', 'xray']
      const cur = order.indexOf(get().viewMode)
      const next = (cur + 1) % order.length
      set({ viewMode: order[next] })
    },


        // ---- Virtual Faces ----
    addVirtualFace: face =>
      set(state => ({ virtualFaces: [...state.virtualFaces, face] })),

    updateVirtualFace: (id, updates) =>
      set(state => ({
        virtualFaces: state.virtualFaces.map(f =>
          f.id === id ? { ...f, ...updates } : f
        )
      })),

    deleteVirtualFace: id =>
      set(state => ({
        virtualFaces: state.virtualFaces.filter(f => f.id !== id)
      })),

    getVirtualFacesForShape: shapeId =>
      get().virtualFaces.filter(v => v.shapeId === shapeId),

    recalculateVirtualFacesForShape: shapeId => {
      const st = get()
      const shape = st.shapes.find(s => s.id === shapeId)
      if (!shape) return

      const vf = st.virtualFaces.filter(v => v.shapeId === shapeId)
      if (vf.length === 0) return

      import('./components/VirtualFaceUpdateService').then(({ recalcVirtual }) => {
        const state = get()
        const shp = state.shapes.find(s => s.id === shapeId)
        if (!shp) return

        const updated = recalcVirtual(shp, state.virtualFaces, state.shapes)
        set({ virtualFaces: updated })
      })
    },

    // ---- Fillet Ops ----
    addFilletFace: idx =>
      set(state => {
        if (state.selectedFilletFaces.includes(idx)) return state
        return { selectedFilletFaces: [...state.selectedFilletFaces, idx] }
      }),

    clearFilletFaces: () =>
      set({ selectedFilletFaces: [], selectedFilletFaceData: [] }),

    addFilletFaceData: data =>
      set(state => ({
        selectedFilletFaceData: [...state.selectedFilletFaceData, data]
      })),

    clearFilletFaceData: () => set({ selectedFilletFaceData: [] }),

    // ---- Role Ops ----
    updateFaceRole: (shapeId, faceIndex, role) =>
      set(state => ({
        shapes: state.shapes.map(sh => {
          if (sh.id !== shapeId) return sh
          return {
            ...sh,
            faceRoles: { ...(sh.faceRoles || {}), [faceIndex]: role }
          }
        })
      })),

    // ---- Raycast ----
    setRaycastMode: enabled =>
      set({ raycastMode: enabled, raycastResults: enabled ? get().raycastResults : [] }),

    // ---- Shape Selection ----
    selectedShapeId: null,
    selectShape: id => {
      const mode = get().activeTool
      if (id && mode === 'Select') {
        set({ selectedShapeId: id, activeTool: 'Move' })
      } else {
        set({ selectedShapeId: id })
      }
    },

    secondarySelectedShapeId: null,
    selectSecondaryShape: id => set({ secondarySelectedShapeId: id }),

    // ---- Grouping ----
    createGroup: (p, s) => {
      const gid = `group-${Date.now()}`
      set(state => ({
        shapes: state.shapes.map(sh => {
          if (sh.id === p) return { ...sh, groupId: gid }
          if (sh.id === s) return { ...sh, groupId: gid, isReferenceBox: true }
          return sh
        })
      }))
    },

    ungroupShapes: gid =>
      set(state => ({
        shapes: state.shapes.map(sh => {
          if (sh.groupId !== gid) return sh
          const { groupId, isReferenceBox, ...rest } = sh
          return rest
        }),
        selectedShapeId: null,
        secondarySelectedShapeId: null
      })),

    // ---- Shape Update ----
    updateShape: (id, updates) =>
      set(state => {
        const target = state.shapes.find(sh => sh.id === id)
        if (!target) return state

        const updated = state.shapes.map(sh => {
          if (sh.id === id) return { ...sh, ...updates }

          if (target.groupId && sh.groupId === target.groupId) {
            if ('position' in updates || 'rotation' in updates || 'scale' in updates) {
              const posΔ = updates.position
                ? [
                    updates.position[0] - target.position[0],
                    updates.position[1] - target.position[1],
                    updates.position[2] - target.position[2]
                  ]
                : [0, 0, 0]

              const rotΔ = updates.rotation
                ? [
                    updates.rotation[0] - target.rotation[0],
                    updates.rotation[1] - target.rotation[1],
                    updates.rotation[2] - target.rotation[2]
                  ]
                : [0, 0, 0]

              const sclΔ = updates.scale
                ? [
                    updates.scale[0] / target.scale[0],
                    updates.scale[1] / target.scale[1],
                    updates.scale[2] / target.scale[2]
                  ]
                : [1, 1, 1]

              return {
                ...sh,
                position: [
                  sh.position[0] + posΔ[0],
                  sh.position[1] + posΔ[1],
                  sh.position[2] + posΔ[2]
                ],
                rotation: [
                  sh.rotation[0] + rotΔ[0],
                  sh.rotation[1] + rotΔ[1],
                  sh.rotation[2] + rotΔ[2]
                ],
                scale: [
                  sh.scale[0] * sclΔ[0],
                  sh.scale[1] * sclΔ[1],
                  sh.scale[2] * sclΔ[2]
                ]
              }
            }
          }

          return sh
        })

        return { shapes: updated }
      }),

    // ---- Shape Delete ----
    deleteShape: id =>
      set(state => {
        const children = state.shapes
          .filter(sh => sh.type === 'panel' && sh.parameters?.parentShapeId === id)
          .map(sh => sh.id)

        const all = new Set([id, ...children])

        return {
          shapes: state.shapes.filter(sh => !all.has(sh.id)),
          selectedShapeId: all.has(state.selectedShapeId) ? null : state.selectedShapeId,
          secondarySelectedShapeId: all.has(state.secondarySelectedShapeId)
            ? null
            : state.secondarySelectedShapeId
        }
      }),

    // ---- Shape Copy ----
    copyShape: id => {
      const st = get()
      const sh = st.shapes.find(s => s.id === id)
      if (!sh) return

      const newOne = {
        ...sh,
        id: `${sh.type}-${Date.now()}`,
        position: [sh.position[0] + 100, sh.position[1], sh.position[2] + 100]
      }

      set({ shapes: [...st.shapes, newOne] })
    },

    // ---- Isolation ----
    isolateShape: id =>
      set(state => ({
        shapes: state.shapes.map(sh => ({
          ...sh,
          isolated: sh.id !== id ? false : undefined
        }))
      })),

    exitIsolation: () =>
      set(state => ({
        shapes: state.shapes.map(sh => ({
          ...sh,
          isolated: undefined
        }))
      })),

    // ---- Extrude ----
    extrudeShape: (id, dist) =>
      set(state => {
        const sh = state.shapes.find(s => s.id === id)
        if (!sh) return state

        const { extrudeGeometry } = require('./services/csg')
        const g = extrudeGeometry(sh.geometry, dist)

        return {
          shapes: state.shapes.map(s =>
            s.id === id ? { ...s, geometry: g } : s
          )
        }
      }),

        // ---- Vertex Modification ----
    addVertexModification: (shapeId, mod) =>
      set(state => ({
        shapes: state.shapes.map(sh => {
          if (sh.id !== shapeId) return sh
          const mods = sh.vertexModifications || []
          const i = mods.findIndex(m => m.vertexIndex === mod.vertexIndex && m.direction === mod.direction)
          const newMods = i >= 0 ? [...mods.slice(0, i), mod, ...mods.slice(i + 1)] : [...mods, mod]
          return { ...sh, vertexModifications: newMods, geometry: sh.geometry }
        })
      })),

    // ---- BOOLEAN OPERATIONS ----
    checkAndPerformBooleanOperations: async () => {
      const state = get()
      const shapes = state.shapes
      if (shapes.length < 2) return

      for (let i = 0; i < shapes.length; i++) {
        for (let j = i + 1; j < shapes.length; j++) {
          const A = shapes[i]
          const B = shapes[j]

          if (!A.geometry || !B.geometry) continue
          if (!A.replicadShape || !B.replicadShape) continue

          const boxA = new THREE.Box3().setFromBufferAttribute(A.geometry.getAttribute('position'))
          const boxB = new THREE.Box3().setFromBufferAttribute(B.geometry.getAttribute('position'))
          boxA.translate(new THREE.Vector3(...A.position))
          boxB.translate(new THREE.Vector3(...B.position))

          if (!boxA.intersectsBox(boxB)) continue

          try {
            const {
              performBooleanCut,
              convertReplicadToThreeGeometry,
              createReplicadBox
            } = await import('./components/ReplicadService')

            const { getReplicadVertices } = await import('./components/VertexEditorService')

            const getSizeData = sh => {
              const box = new THREE.Box3().setFromBufferAttribute(sh.geometry.getAttribute('position'))
              const size = new THREE.Vector3()
              const center = new THREE.Vector3()
              box.getSize(size)
              box.getCenter(center)
              return { size, center }
            }

            const a = getSizeData(A)
            const b = getSizeData(B)

            const isCentered = c =>
              Math.abs(c.x) < 0.01 && Math.abs(c.y) < 0.01 && Math.abs(c.z) < 0.01

            const offsetA = [
              isCentered(a.center) ? a.size.x / 2 : 0,
              isCentered(a.center) ? a.size.y / 2 : 0,
              isCentered(a.center) ? a.size.z / 2 : 0
            ]

            const offsetB = [
              isCentered(b.center) ? b.size.x / 2 : 0,
              isCentered(b.center) ? b.size.y / 2 : 0,
              isCentered(b.center) ? b.size.z / 2 : 0
            ]

            const cornerA = [
              A.position[0] - offsetA[0],
              A.position[1] - offsetA[1],
              A.position[2] - offsetA[2]
            ]

            const cornerB = [
              B.position[0] - offsetB[0],
              B.position[1] - offsetB[1],
              B.position[2] - offsetB[2]
            ]

            const relativeOffset = [
              cornerB[0] - cornerA[0],
              cornerB[1] - cornerA[1],
              cornerB[2] - cornerA[2]
            ]

            const relativeRotation = [
              B.rotation[0] - A.rotation[0],
              B.rotation[1] - A.rotation[1],
              B.rotation[2] - A.rotation[2]
            ]

            const ABox = await createReplicadBox({
              width: a.size.x,
              height: a.size.y,
              depth: a.size.z
            })

            const BBox = await createReplicadBox({
              width: b.size.x,
              height: b.size.y,
              depth: b.size.z
            })

            let result = await performBooleanCut(
              ABox,
              BBox,
              undefined,
              relativeOffset,
              undefined,
              relativeRotation,
              undefined,
              B.scale
            )

            let newGeom = convertReplicadToThreeGeometry(result)
            let newVerts = await getReplicadVertices(result)

            let fillets = A.fillets || []
            if (fillets.length > 0) {
              const { updateFilletCentersForNewGeometry, applyFillets } = await import('./components/ShapeUpdaterService')
              fillets = await updateFilletCentersForNewGeometry(fillets, newGeom, {
                width: a.size.x,
                height: a.size.y,
                depth: a.size.z
              })

              result = await applyFillets(result, fillets, {
                width: a.size.x,
                height: a.size.y,
                depth: a.size.z
              })

              newGeom = convertReplicadToThreeGeometry(result)
              newVerts = await getReplicadVertices(result)
            }

            const subGeom = B.geometry.clone()

            set(state => ({
              shapes: state.shapes
                .map(sh => {
                  if (sh.id !== A.id) return sh
                  return {
                    ...sh,
                    geometry: newGeom,
                    replicadShape: result,
                    fillets,
                    subtractionGeometries: [
                      ...(sh.subtractionGeometries || []),
                      {
                        geometry: subGeom,
                        relativeOffset,
                        relativeRotation,
                        scale: [1, 1, 1],
                        parameters: {
                          width: String(b.size.x),
                          height: String(b.size.y),
                          depth: String(b.size.z),
                          posX: String(relativeOffset[0]),
                          posY: String(relativeOffset[1]),
                          posZ: String(relativeOffset[2]),
                          rotX: String(relativeRotation[0] * (180 / Math.PI)),
                          rotY: String(relativeRotation[1] * (180 / Math.PI)),
                          rotZ: String(relativeRotation[2] * (180 / Math.PI))
                        }
                      }
                    ],
                    parameters: {
                      ...sh.parameters,
                      scaledBaseVertices: newVerts.map(v => [v.x, v.y, v.z])
                    }
                  }
                })
                .filter(sh => sh.id !== B.id)
            }))

            import('./components/PanelJointService').then(({ rebuildAndRecalculatePipeline }) =>
              rebuildAndRecalculatePipeline(A.id, null)
            )

            return
          } catch (err) {
            console.error(err)
          }
        }
      }
    },

    // ---- DELETE SUBTRACTION ----
    deleteSubtraction: async (shapeId, index) => {
      const state = get()
      const shape = state.shapes.find(sh => sh.id === shapeId)
      if (!shape || !shape.subtractionGeometries) return

      const subs = [...shape.subtractionGeometries]
      subs[index] = null

      try {
        const {
          performBooleanCut,
          convertReplicadToThreeGeometry,
          createReplicadBox
        } = await import('./components/ReplicadService')

        const { getReplicadVertices } = await import('./components/VertexEditorService')

        const w = shape.parameters?.width || 1
        const h = shape.parameters?.height || 1
        const d = shape.parameters?.depth || 1

        const pos = [...shape.position]

        let base = await createReplicadBox({ width: w, height: h, depth: d })

        for (let s of subs) {
          if (!s) continue

          const sw = parseFloat(s.parameters?.width) || 1
          const sh = parseFloat(s.parameters?.height) || 1
          const sd = parseFloat(s.parameters?.depth) || 1

          const sub = await createReplicadBox({ width: sw, height: sh, depth: sd })

          base = await performBooleanCut(
            base,
            sub,
            undefined,
            s.relativeOffset,
            undefined,
            s.relativeRotation,
            undefined,
            s.scale || [1, 1, 1]
          )
        }

        let newGeom = convertReplicadToThreeGeometry(base)
        let verts = await getReplicadVertices(base)

        let fillets = shape.fillets || []
        if (fillets.length > 0) {
          const { updateFilletCentersForNewGeometry, applyFillets } = await import('./components/ShapeUpdaterService')
          fillets = await updateFilletCentersForNewGeometry(fillets, newGeom, { width: w, height: h, depth: d })
          base = await applyFillets(base, fillets, { width: w, height: h, depth: d })
          newGeom = convertReplicadToThreeGeometry(base)
          verts = await getReplicadVertices(base)
        }

        set(state => ({
          shapes: state.shapes.map(sh => {
            if (sh.id !== shapeId) return sh
            return {
              ...sh,
              geometry: newGeom,
              replicadShape: base,
              subtractionGeometries: subs,
              fillets,
              position: pos,
              parameters: {
                ...sh.parameters,
                scaledBaseVertices: verts.map(v => [v.x, v.y, v.z])
              }
            }
          }),
          selectedSubtractionIndex: null
        }))

        import('./components/PanelJointService').then(({ rebuildAndRecalculatePipeline }) =>
          rebuildAndRecalculatePipeline(shapeId, null)
        )
      } catch (err) {
        console.error(err)
      }
    }

  }
})
