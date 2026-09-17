import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { computeUvMatrix, makeImageTexture, type ArtTransform } from './artwork'
import { artworkMaterialOf } from './slot'
import { disposeObject } from './geometry'
import type { BuildConfig, MockupDefinition } from './models'
import type { SlotDefinition } from './models/types'

export interface ViewerCallbacks {
  onSlotsChange(slots: { id: string; label: string; hint?: string }[]): void
  onDragTransform(slot: string, offsetX: number, offsetY: number): void
  onDragStateChange(dragging: boolean): void
}

interface SlotRuntime {
  def: SlotDefinition
  imageId: string | null
  texture?: THREE.Texture
  aspect: number
  transform: ArtTransform
}

const DEFAULT_FOV = 30

export class MockupViewer {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.01, 60)
  readonly controls: OrbitControls

  private root = new THREE.Group()
  private slots = new Map<string, SlotRuntime>()
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private shadowPlane: THREE.Mesh
  private keyLight: THREE.DirectionalLight
  private frame = 0
  private needsRender = true
  private activeSlot: string | null = null
  private dragging: { slot: string; lastU: number; lastV: number } | null = null
  private disposed = false

  constructor(private canvas: HTMLCanvasElement, private callbacks: ViewerCallbacks) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.42
    pmrem.dispose()

    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.15)
    this.keyLight.position.set(1.1, 1.8, 1.6)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.set(2048, 2048)
    this.keyLight.shadow.bias = -0.0012
    this.keyLight.shadow.radius = 5
    this.keyLight.shadow.normalBias = 0.012
    this.scene.add(this.keyLight, this.keyLight.target)

    const fill = new THREE.DirectionalLight(0xdfe6f5, 0.55)
    fill.position.set(-1.6, 0.6, 1.1)
    this.scene.add(fill)

    const rim = new THREE.DirectionalLight(0xffffff, 0.45)
    rim.position.set(-0.4, 1.0, -1.8)
    this.scene.add(rim)

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.22))

    this.shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.ShadowMaterial({ opacity: 0.12, transparent: true }),
    )
    this.shadowPlane.rotation.x = -Math.PI / 2
    this.shadowPlane.receiveShadow = true
    this.scene.add(this.shadowPlane)
    this.scene.add(this.root)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = false
    this.controls.rotateSpeed = 0.85
    this.controls.zoomSpeed = 0.8
    this.controls.minDistance = 0.3
    this.controls.maxDistance = 12
    this.controls.addEventListener('change', () => {
      this.needsRender = true
    })

    canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)

    this.loop()
  }

  // ---------------------------------------------------------------- modello

  setMockup(model: MockupDefinition, cfg: BuildConfig, keep = true) {
    const previous = new Map(this.slots)
    this.clearRoot()

    const built = model.build(cfg)
    this.root.add(built.group)

    this.slots.clear()
    built.slots.forEach((def) => {
      const before = keep ? previous.get(def.id) : undefined
      const runtime: SlotRuntime = {
        def,
        imageId: before?.imageId ?? null,
        texture: before?.texture,
        aspect: before?.aspect ?? 1,
        transform: before?.transform ?? {
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          flipX: false,
        },
      }
      this.slots.set(def.id, runtime)
      this.applySlot(runtime)
    })

    this.fitCamera(built.camera)
    this.callbacks.onSlotsChange(
      built.slots.map((s) => ({ id: s.id, label: s.label, hint: s.hint })),
    )
    this.needsRender = true
  }

  private clearRoot() {
    while (this.root.children.length) {
      const child = this.root.children[0]
      this.root.remove(child)
      disposeObject(child)
    }
  }

  private fitCamera(hint: { azimuth: number; polar: number; distanceFactor?: number }) {
    const box = new THREE.Box3().setFromObject(this.root)
    if (box.isEmpty()) return
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const fov = THREE.MathUtils.degToRad(this.camera.fov)
    const dist = (sphere.radius / Math.sin(fov / 2)) * (hint.distanceFactor ?? 1) * 1.08

    this.controls.target.copy(sphere.center)
    const az = hint.azimuth
    const polar = hint.polar
    this.camera.position.set(
      sphere.center.x + dist * Math.sin(polar) * Math.sin(az),
      sphere.center.y + dist * Math.cos(polar),
      sphere.center.z + dist * Math.sin(polar) * Math.cos(az),
    )
    this.controls.minDistance = sphere.radius * 1.05
    this.controls.maxDistance = sphere.radius * 6
    this.controls.update()

    // piani di taglio stretti attorno all'oggetto: senza, le grafiche appoggiate
    // a pochi decimi di millimetro dal supporto entrano in z-fighting
    this.camera.near = Math.max(0.01, sphere.radius * 0.04)
    this.camera.far = sphere.radius * 14
    this.camera.updateProjectionMatrix()

    this.keyLight.position.copy(sphere.center).add(
      new THREE.Vector3(sphere.radius * 1.5, sphere.radius * 2.2, sphere.radius * 1.9),
    )
    this.keyLight.target.position.copy(sphere.center)
    this.keyLight.target.updateMatrixWorld()
    const d = sphere.radius * 3.2
    const cam = this.keyLight.shadow.camera as THREE.OrthographicCamera
    cam.left = -d
    cam.right = d
    cam.top = d
    cam.bottom = -d
    cam.near = 0.01
    cam.far = d * 4
    cam.updateProjectionMatrix()

    this.shadowPlane.position.y = box.min.y - 0.002
    this.shadowPlane.scale.setScalar(Math.max(1, sphere.radius * 2))
  }

  // ------------------------------------------------------------------ slot

  setSlotImage(slotId: string, image: HTMLImageElement | null, imageId: string | null = null) {
    const runtime = this.slots.get(slotId)
    if (!runtime) return
    if (runtime.imageId === imageId && Boolean(runtime.texture) === Boolean(image)) return
    runtime.texture?.dispose()
    runtime.imageId = imageId
    if (image) {
      runtime.texture = makeImageTexture(image, this.renderer)
      runtime.aspect = image.naturalWidth / image.naturalHeight
    } else {
      runtime.texture = undefined
      runtime.aspect = 1
    }
    this.applySlot(runtime)
  }

  setSlotTransform(slotId: string, transform: ArtTransform) {
    const runtime = this.slots.get(slotId)
    if (!runtime) return
    runtime.transform = transform
    this.applySlot(runtime)
  }

  setActiveSlot(slotId: string | null) {
    this.activeSlot = slotId
  }

  private applySlot(runtime: SlotRuntime) {
    const matrix = computeUvMatrix(runtime.def.area, runtime.aspect, runtime.transform)
    runtime.def.meshes.forEach((mesh) => {
      const mat = artworkMaterialOf(mesh)
      mat.map = runtime.texture ?? null
      mat.opacity = runtime.transform.opacity
      mat.needsUpdate = true
      mat.userData.setUvMatrix(matrix)
      mesh.visible = Boolean(runtime.texture)
    })
    this.needsRender = true
  }

  hasAnyImage() {
    return Array.from(this.slots.values()).some((s) => Boolean(s.texture))
  }

  // ------------------------------------------------------- interazione mouse

  private updatePointer(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
  }

  private hitActiveArtwork() {
    if (!this.activeSlot) return null
    const runtime = this.slots.get(this.activeSlot)
    if (!runtime || !runtime.texture) return null
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(runtime.def.meshes, false)
    for (const hit of hits) {
      if (!hit.uv) continue
      const m = computeUvMatrix(runtime.def.area, runtime.aspect, runtime.transform)
      const p = new THREE.Vector3(hit.uv.x, hit.uv.y, 1).applyMatrix3(m)
      if (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) {
        return { runtime, u: hit.uv.x, v: hit.uv.y }
      }
    }
    return null
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    this.updatePointer(event)
    const hit = this.hitActiveArtwork()
    if (hit) {
      this.dragging = { slot: hit.runtime.def.id, lastU: hit.u, lastV: hit.v }
      this.controls.enabled = false
      this.callbacks.onDragStateChange(true)
    }
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.dragging) {
      this.updatePointer(event)
      this.canvas.style.cursor = this.hitActiveArtwork() ? 'move' : 'grab'
      return
    }
    this.updatePointer(event)
    const runtime = this.slots.get(this.dragging.slot)
    if (!runtime) return
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(runtime.def.meshes, false)
    const hit = hits.find((h) => h.uv)
    if (!hit || !hit.uv) return
    const du = hit.uv.x - this.dragging.lastU
    const dv = hit.uv.y - this.dragging.lastV
    this.dragging.lastU = hit.uv.x
    this.dragging.lastV = hit.uv.y
    const t = runtime.transform
    const nx = THREE.MathUtils.clamp(t.offsetX + du * 2, -1.5, 1.5)
    const ny = THREE.MathUtils.clamp(t.offsetY + dv * 2, -1.5, 1.5)
    this.callbacks.onDragTransform(runtime.def.id, nx, ny)
  }

  private onPointerUp = () => {
    if (this.dragging) {
      this.dragging = null
      this.controls.enabled = true
      this.callbacks.onDragStateChange(false)
    }
  }

  // ------------------------------------------------------------- rendering

  setShadow(enabled: boolean) {
    this.shadowPlane.visible = enabled
    this.needsRender = true
  }

  resize(width: number, height: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.needsRender = true
  }

  resetView(model: MockupDefinition, cfg: BuildConfig) {
    const built = model.build(cfg)
    this.fitCamera(built.camera)
    disposeObject(built.group)
    this.needsRender = true
  }

  /** Inquadratura corrente in PNG con fondo trasparente. */
  snapshot(pixelWidth: number, pixelHeight: number): string {
    const oldSize = new THREE.Vector2()
    this.renderer.getSize(oldSize)
    const oldPixelRatio = this.renderer.getPixelRatio()
    const oldAspect = this.camera.aspect

    this.renderer.setPixelRatio(1)
    this.renderer.setSize(pixelWidth, pixelHeight, false)
    this.camera.aspect = pixelWidth / pixelHeight
    this.camera.updateProjectionMatrix()
    this.renderer.render(this.scene, this.camera)
    const url = this.renderer.domElement.toDataURL('image/png')

    this.renderer.setPixelRatio(oldPixelRatio)
    this.renderer.setSize(oldSize.x, oldSize.y, false)
    this.camera.aspect = oldAspect
    this.camera.updateProjectionMatrix()
    this.needsRender = true
    return url
  }

  requestRender() {
    this.needsRender = true
  }

  private loop = () => {
    if (this.disposed) return
    this.frame = requestAnimationFrame(this.loop)
    const damped = this.controls.update()
    if (damped || this.needsRender) {
      this.renderer.render(this.scene, this.camera)
      this.needsRender = false
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    this.controls.dispose()
    this.clearRoot()
    this.slots.forEach((s) => s.texture?.dispose())
    this.slots.clear()
    this.renderer.dispose()
  }
}
