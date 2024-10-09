import React from 'react';
import * as ogl from 'ogl';
import {useRecoilState} from 'recoil';
import {panZoomState} from './atoms';

class DataTimelineGLContext {
  constructor(public renderer: ogl.Renderer) {
    const gl = renderer.gl;

    // Triangle that covers viewport, with UVs that still span 0 > 1 across
    // viewport
    const geometry = new ogl.Geometry(gl, {
      position: {size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3])},
    });
    // Alternatively, you could use the Triangle class.

    const program = new ogl.Program(gl, {
      vertex: /* glsl */ `
        #pragma vscode_glsllint_stage: vert
        attribute vec2 position;

        void main() {
          gl_Position = vec4(position, 0, 1);
        }
      `,
      fragment: /* glsl */ `
        #pragma vscode_glsllint_stage: frag
        precision highp float;

        uniform vec2 iResolution;

        void main() {
          vec4 gridLineColor = vec4(0,0,0,1);
          float lineVisible = floor(mod(gl_FragCoord.x, 100.0));
          if (lineVisible != 0.0) {
            gl_FragColor = vec4(1,1,1,1);
          } else {
            gl_FragColor = gridLineColor;
          }
        }
      `,
      uniforms: {
        iResolution: {value: [800, 800]},
      },
    });

    const mesh = new ogl.Mesh(gl, {geometry, program});
    requestAnimationFrame(update);
    function update(_t: number) {
      requestAnimationFrame(update);

      program.uniforms.iResolution.value[0] = renderer.width;
      program.uniforms.iResolution.value[1] = renderer.height;

      // Don't need a camera if camera uniforms aren't required
      renderer.render({scene: mesh});
    }
  }
}

export function DataTimelineGL(_props: {data: Uint8Array}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const c = React.useRef<DataTimelineGLContext | null>(null);

  React.useLayoutEffect(() => {
    if (wrapperRef.current == null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry == null) return;
      const rect = entry.contentRect;
      if (rect == null) return;
      const {width, height} = rect;
      if (canvasRef.current == null) return;
      if (c.current == null) {
        c.current = new DataTimelineGLContext(
          new ogl.Renderer({
            canvas: canvasRef.current,
            width,
            height,
          }),
        );
      }
      c.current.renderer.setSize(width, height);
      c.current.renderer.setViewport(width, height);
    });
    observer.observe(wrapperRef.current);

    return () => {
      console.log('observer.disconnect()');
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={wrapperRef} className="self-stretch flex-grow overflow-hidden">
      <canvas ref={canvasRef} />
    </div>
  );
}

type PanZoom = {
  start: number;
  end: number;
};

class DataTimeline2DCanvas {
  ctx: CanvasRenderingContext2D;
  dpr: number;

  constructor(
    public canvas: HTMLCanvasElement,
    public width: number,
    public height: number,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to get 2d canvas context');
    this.ctx = ctx;
    const dpr = (this.dpr = window.devicePixelRatio);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);
  }

  render(data: Uint8Array, panZoom: PanZoom) {
    console.log('render');
    const ctx = this.ctx;

    // ctx.fillStyle = 'whitesmoke'; ctx.fillRect(0, 0, ctx.canvas.width,
    // ctx.canvas.height);

    // Draw horizontal tracks
    {
      const spacing = ctx.canvas.height / this.dpr / 8;
      for (let i = 0; i * spacing < ctx.canvas.height; ++i) {
        const y = i * spacing;
        ctx.fillStyle = i % 2 ? 'white' : 'whitesmoke';
        ctx.fillRect(0, y, ctx.canvas.width, spacing);
        // ctx.lineWidth = 0.5; ctx.strokeStyle = '#666'; ctx.beginPath();
        // ctx.moveTo(0, y - 0.5); ctx.lineTo(ctx.canvas.width, y - 0.5);
        // ctx.stroke();
      }
    }

    // Draw waveforms:
    {
      const vspacing = ctx.canvas.height / this.dpr / 8;
      const iStart = Math.floor(panZoom.start * data.byteLength);
      const iEnd = Math.floor(panZoom.end * data.byteLength);
      const iInc = Math.ceil(
        (iEnd - iStart) / (ctx.canvas.width / this.dpr / 0.1),
      );
      ctx.lineWidth = 0.5;
      const vpadding = (ctx.canvas.height / 8) * 0.025;
      for (let j = 0; j < 8; ++j) {
        ctx.strokeStyle = j % 2 ? 'red' : 'green';
        const bit = 1 << j;
        const top = j * vspacing;
        ctx.beginPath();
        for (let i = iStart; i < iEnd; i += iInc) {
          const byte = data[i];
          const x =
            ((i - iStart) / (iEnd - iStart)) * (ctx.canvas.width / this.dpr);
          if (byte == null) break;
          if ((byte & bit) === 0) {
            ctx.lineTo(x, top + vspacing - vpadding);
          } else {
            ctx.lineTo(x, top + vpadding);
          }
        }
        ctx.stroke();
      }
    }

    // Draw vertical lines
    // {
    //   ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.5; const spacing = 100; for
    //   (let x = 0; x < ctx.canvas.width; x += spacing) { ctx.beginPath();
    //   ctx.moveTo(x - 0.5, 0); ctx.lineTo(x - 0.5, ctx.canvas.height);
    //   ctx.stroke();
    //   }
    // }
  }
}

export function DataTimelineCanvas2D({data: data_}: {data: Uint8Array}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dataRef = React.useRef<Uint8Array>(data_);
  const context = React.useRef<DataTimeline2DCanvas | null>(null);
  const observerRef = React.useRef<ResizeObserver | null>(null);
  const [panZoom, setPanZoom] = useRecoilState(panZoomState);
  const panZoomRef = React.useRef<PanZoom>(panZoom);
  React.useEffect(() => {
    dataRef.current = data_;
    panZoomRef.current = panZoom;
    context.current?.render(data_, panZoomRef.current);
  }, [data_, panZoom]);

  const handleWheel = React.useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      if (context.current == null) return;
      const span = panZoomRef.current.end - panZoomRef.current.start;
      if (event.ctrlKey || event.metaKey) {
        // Zooming

        // First determine x coord in [0, 1] normalized form
        //
        // This will be our focal point when calculating the zoom's impact on
        // `position`:
        const x = event.offsetX / context.current?.width;
        const {deltaY} = event;
        const deltaZoom = -deltaY * 0.01;
        const rate = 3.0;
        const start = Math.max(
          0,
          panZoomRef.current.start + deltaZoom * x * span * rate,
        );
        const end = Math.min(
          1,
          panZoomRef.current.end - deltaZoom * (1 - x) * span * rate,
        );
        setPanZoom({start, end});
      } else {
        // Panning
        const {deltaX} = event;
        const rate = 0.0025;
        let start = panZoomRef.current.start + deltaX * span * rate;
        let end = panZoomRef.current.end + deltaX * span * rate;
        if (start < 0) {
          const safeDelta = -panZoomRef.current.start;
          start = 0;
          end = panZoomRef.current.end + safeDelta;
        } else if (end > 1) {
          const safeDelta = 1 - panZoomRef.current.end;
          end = 1;
          start = panZoomRef.current.start + safeDelta;
        }

        setPanZoom({start, end});
      }
      context.current.render(dataRef.current, panZoomRef.current);
    },
    [setPanZoom],
  );

  const [dimensions, setDimensions] = React.useState<{
    width: number;
    height: number;
  }>({width: 0, height: 0});

  const handleWrapperRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (el == null) {
        console.log('observer.disconnect()');
        observerRef.current?.disconnect();
      } else {
        el.addEventListener('wheel', handleWheel);
        observerRef.current = new ResizeObserver(([entry]) => {
          if (entry == null) return;
          const rect = entry.contentRect;
          if (rect == null) return;
          const {width, height} = rect;
          if (canvasRef.current == null) return;
          setDimensions({width, height});
          context.current = new DataTimeline2DCanvas(
            canvasRef.current,
            width,
            height,
          );
          context.current.render(dataRef.current, panZoomRef.current);
        });
        observerRef.current.observe(el);
        console.log('observer.observe()');
      }
    },
    [handleWheel],
  );

  const [regionBeingSelected, setRegionBeingSelected_] =
    React.useState<null | PanZoom>(null);

  React.useEffect(() => {
    let mouseX = 0;
    let regionBeingSelected_: null | PanZoom = null;
    let dragStartX: null | number = null;
    const setRegionBeingSelected = (v: null | PanZoom) => {
      regionBeingSelected_ = v;
      setRegionBeingSelected_(v);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        const start = mouseX / window.innerWidth;
        const end = (mouseX + 1) / window.innerWidth;
        setRegionBeingSelected({
          start,
          end,
        });
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setRegionBeingSelected(null);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX;
      if (regionBeingSelected_) {
        if (dragStartX) {
          const end = event.clientX / window.innerWidth;
          if (end < dragStartX) {
            setRegionBeingSelected({start: end, end: dragStartX});
          } else {
            setRegionBeingSelected({start: dragStartX, end});
          }
        } else {
          const start = mouseX / window.innerWidth;
          const end = (mouseX + 1) / window.innerWidth;
          setRegionBeingSelected({
            start,
            end,
          });
        }
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      dragStartX = event.clientX / window.innerWidth;
    };
    const handleMouseUp = (event: MouseEvent) => {
      if (dragStartX != null && regionBeingSelected_ != null) {
        const end = event.clientX / window.innerWidth;
        const scale = panZoom.end - panZoom.start;
        if (end < dragStartX) {
          setPanZoom({
            start: panZoom.start + end * scale,
            end: panZoom.start + dragStartX * scale,
          });
        } else {
          setPanZoom({
            start: panZoom.start + dragStartX * scale,
            end: panZoom.start + end * scale,
          });
        }
      }
      dragStartX = null;
      setRegionBeingSelected(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [panZoom.end, panZoom.start, setPanZoom]);

  return (
    <div
      ref={handleWrapperRef}
      className="self-stretch flex-grow overflow-hidden relative"
    >
      <canvas ref={canvasRef} />
      {regionBeingSelected && (
        <svg
          {...dimensions}
          className="absolute top-0"
          style={{
            cursor: 'ew-resize',
          }}
        >
          <mask
            id="selection-cutout-mask"
            x="0"
            y="0"
            width="100%"
            height="100%"
          >
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={`${regionBeingSelected.start * 100}%`}
              y="0"
              width={`${(regionBeingSelected.end - regionBeingSelected.start) * 100}%`}
              height="100%"
              fill="black"
            />
          </mask>
          <rect
            x="0"
            y="0"
            {...dimensions}
            fill="rgba(0,0,0,0.1)"
            mask="url(#selection-cutout-mask)"
          />
        </svg>
      )}
    </div>
  );
}

class DataTimelineMiniMapCanvas {
  timeline: DataTimeline2DCanvas;
  ctx: CanvasRenderingContext2D;
  dpr: number;

  constructor(
    data: Uint8Array,
    public canvas: HTMLCanvasElement,
    public width: number,
    public height: number,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to get 2d canvas context');
    this.ctx = ctx;
    const dpr = (this.dpr = window.devicePixelRatio);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    const timelineCanvas = document.createElement('canvas');
    timelineCanvas.width = canvas.width;
    timelineCanvas.height = canvas.height;

    this.timeline = new DataTimeline2DCanvas(timelineCanvas, width, height);
    this.renderAll(data, {start: 0, end: 1});
  }

  renderAll(data: Uint8Array, panZoom: PanZoom) {
    this.timeline.render(data, {start: 0, end: 1});
    this.renderPanZoom(panZoom);
  }

  renderPanZoom(_panZoom: PanZoom) {
    const timelineCanvas = this.timeline.canvas;
    this.ctx.drawImage(
      timelineCanvas,
      0,
      0,
      timelineCanvas.width * this.dpr,
      timelineCanvas.height * this.dpr,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
  }
}

export function DataTimelineMinimap({
  style,
  data: data_,
}: {
  style?: React.CSSProperties;
  data: Uint8Array;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dataRef = React.useRef<Uint8Array>(data_);
  const context = React.useRef<DataTimelineMiniMapCanvas | null>(null);
  const observerRef = React.useRef<ResizeObserver | null>(null);
  const [dimensions, setDimensions] = React.useState<{
    width: number;
    height: number;
  }>({width: 0, height: 0});
  const [panZoom, setPanZoom] = useRecoilState(panZoomState);
  const panZoomRef = React.useRef<PanZoom>(panZoom);

  React.useEffect(() => {
    panZoomRef.current = panZoom;
    dataRef.current = data_;
    context.current?.renderAll(data_, panZoomRef.current);
  }, [data_, panZoom]);

  const handleWheel = React.useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      if (context.current == null) return;
      const span = panZoomRef.current.end - panZoomRef.current.start;
      if (event.ctrlKey || event.metaKey) {
        // Zooming

        // First determine x coord in [0, 1] normalized form
        //
        // This will be our focal point when calculating the zoom's impact on
        // `position`:
        const x = event.offsetX / context.current?.width;
        const {deltaY} = event;
        const deltaZoom = -deltaY * 0.01;
        const rate = 3.0;
        const start = Math.max(
          0,
          panZoomRef.current.start + deltaZoom * x * span * rate,
        );
        const end = Math.min(
          1,
          panZoomRef.current.end - deltaZoom * (1 - x) * span * rate,
        );
        setPanZoom({start, end});
      } else {
        // Panning
        const {deltaX} = event;
        const rate = 0.0025;
        let start = panZoomRef.current.start + deltaX * span * rate;
        let end = panZoomRef.current.end + deltaX * span * rate;
        if (start < 0) {
          const safeDelta = -panZoomRef.current.start;
          start = 0;
          end = panZoomRef.current.end + safeDelta;
        } else if (end > 1) {
          const safeDelta = 1 - panZoomRef.current.end;
          end = 1;
          start = panZoomRef.current.start + safeDelta;
        }

        setPanZoom({start, end});
      }
      context.current.renderPanZoom(panZoomRef.current);
    },
    [setPanZoom],
  );

  const handleWrapperRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (el == null) {
        console.log('minimap observer.disconnect()');
        observerRef.current?.disconnect();
      } else {
        el.addEventListener('wheel', handleWheel);
        observerRef.current = new ResizeObserver(([entry]) => {
          if (entry == null) return;
          const rect = entry.contentRect;
          if (rect == null) return;
          const {width, height} = rect;
          setDimensions({width, height});
          if (canvasRef.current == null) return;
          context.current = new DataTimelineMiniMapCanvas(
            dataRef.current,
            canvasRef.current,
            width,
            height,
          );
          context.current.renderPanZoom(panZoomRef.current);
        });
        observerRef.current.observe(el);
        console.log('minimap observer.observe()');
      }
    },
    [handleWheel],
  );

  const [draggingWindow, setDraggingWindow] = React.useState(false);

  React.useEffect(() => {
    const handleMouseUp = () => {
      setDraggingWindow(false);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div
      ref={handleWrapperRef}
      style={style}
      className="self-stretch flex-grow overflow-hidden relative"
      onMouseDown={(event) => {
        const start = event.clientX / dimensions.width;
        const end = (event.clientX + 1) / dimensions.width;
        setPanZoom({start, end});
        const mouseDownStart = start;
        const body = document.querySelector('body');
        if (body) {
          body.style.userSelect = 'none';
        }

        const handleMouseMove = (moveEvent: MouseEvent) => {
          const end = moveEvent.clientX / dimensions.width;
          if (end < mouseDownStart) {
            setPanZoom({start: end, end: mouseDownStart});
          } else {
            setPanZoom({start: mouseDownStart, end});
          }
        };

        window.addEventListener('mousemove', handleMouseMove);

        const handleMouseUp = () => {
          const body = document.querySelector('body');
          if (body) {
            body.style.userSelect = 'initial';
          }

          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
        };
        window.addEventListener('mouseup', handleMouseUp);
      }}
    >
      <canvas
        style={{
          position: 'absolute',
          top: 10,
        }}
        ref={canvasRef}
      />
      <svg {...dimensions} className="absolute">
        <defs>
          <mask id="cutout-mask" x="0" y="0" width="100%" height="100%">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={`${panZoom.start * 100}%`}
              y="0"
              width={`${(panZoom.end - panZoom.start) * 100}%`}
              height="100%"
              fill="black"
            />
          </mask>
        </defs>

        <rect
          x="0"
          y="0"
          width={dimensions.width}
          height={dimensions.height + 10}
          fill="rgba(0,0,0,0.1)"
          mask="url(#cutout-mask)"
        />
        <rect
          x={`${panZoom.start * 100}%`}
          y="0px"
          width={`${Math.max(2, (panZoom.end - panZoom.start) * 100)}%`}
          height="10px"
          fill="purple"
          style={{
            cursor: draggingWindow ? 'grabbing' : 'grab',
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const body = document.querySelector('body');
            if (body) {
              body.style.userSelect = 'none';
            }
            let deltaX = 0;

            const handleMouseMove = (moveEvent: MouseEvent) => {
              deltaX += moveEvent.movementX / dimensions.width;
              setPanZoom({
                start: panZoom.start + deltaX,
                end: panZoom.end + deltaX,
              });
              return;
            };

            window.addEventListener('mousemove', handleMouseMove);

            const handleMouseUp = () => {
              const body = document.querySelector('body');
              if (body) {
                body.style.userSelect = 'initial';
              }

              window.removeEventListener('mousemove', handleMouseMove);
              window.removeEventListener('mouseup', handleMouseUp);
            };
            window.addEventListener('mouseup', handleMouseUp);
          }}
        />
      </svg>
    </div>
  );
}
