import React from 'react';
import * as ogl from 'ogl';

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
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = '#666';
        ctx.beginPath();
        ctx.moveTo(0, y - 0.5);
        ctx.lineTo(ctx.canvas.width, y - 0.5);
        ctx.stroke();
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
      console.log({iStart, iEnd, iInc});
      ctx.lineWidth = 1.0;
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
            ctx.lineTo(x, top + vspacing - 10);
          } else {
            ctx.lineTo(x, top + 10);
          }
        }
        ctx.stroke();
      }
    }

    // Draw vertical lines
    {
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 0.5;
      const spacing = 100;
      for (let x = 0; x < ctx.canvas.width; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x - 0.5, 0);
        ctx.lineTo(x - 0.5, ctx.canvas.height);
        ctx.stroke();
      }
    }
  }
}

export function DataTimelineCanvas2D({data: data_}: {data: Uint8Array}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dataRef = React.useRef<Uint8Array>(data_);
  const context = React.useRef<DataTimeline2DCanvas | null>(null);
  const observerRef = React.useRef<ResizeObserver | null>(null);
  const panZoomRef = React.useRef<PanZoom>({
    start: 0.0,
    end: 1.0,
  });

  React.useEffect(() => {
    dataRef.current = data_;
    context.current?.render(data_, panZoomRef.current);
  }, [data_]);

  const handleWheel = React.useCallback((event: WheelEvent) => {
    event.preventDefault();
    if (context.current == null) return;
    const span = panZoomRef.current.end - panZoomRef.current.start;
    if (event.ctrlKey) {
      // Zooming

      // First determine x coord in [0, 1] normalized form
      //
      // This will be our focal point when calculating the zoom's impact on
      // `position`:
      const x = event.offsetX / context.current?.width;
      const {deltaY} = event;
      const deltaZoom = -deltaY * 0.01;
      const rate = 3.0;
      panZoomRef.current.start = Math.max(
        0,
        panZoomRef.current.start + deltaZoom * x * span * rate,
      );
      panZoomRef.current.end = Math.min(
        1,
        panZoomRef.current.end - deltaZoom * (1 - x) * span * rate,
      );
    } else {
      // Scrolling
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

      panZoomRef.current.start = start;
      panZoomRef.current.end = end;
    }
    console.log(panZoomRef.current);
    context.current.render(dataRef.current, panZoomRef.current);
  }, []);

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

  return (
    <div
      ref={handleWrapperRef}
      className="self-stretch flex-grow overflow-hidden"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
