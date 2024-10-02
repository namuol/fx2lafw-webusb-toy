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

class DataTimeline2DContext {
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

  render(data: Uint8Array) {
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
      const spacing = 1;
      const vspacing = ctx.canvas.height / this.dpr / 8;

      for (let j = 0; j < 8; ++j) {
        ctx.strokeStyle = j % 2 ? 'red' : 'green';
        let x = 0;
        const bit = 1 << j;
        const top = j * vspacing;
        ctx.beginPath();
        for (let i = 0; i < data.byteLength && x < ctx.canvas.width; ++i) {
          const byte = data[i];
          if (byte == null) break;
          if ((byte & bit) === 0) {
            ctx.lineTo(x, top + vspacing - 5);
          } else {
            ctx.lineTo(x, top + 5);
          }
          x += spacing;
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

export function DataTimelineCanvas2D({data}: {data: Uint8Array}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const c = React.useRef<DataTimeline2DContext | null>(null);

  React.useLayoutEffect(() => {
    if (wrapperRef.current == null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry == null) return;
      const rect = entry.contentRect;
      if (rect == null) return;
      const {width, height} = rect;
      if (canvasRef.current == null) return;
      c.current = new DataTimeline2DContext(canvasRef.current, width, height);
      c.current.render(data);
    });
    observer.observe(wrapperRef.current);

    return () => {
      console.log('observer.disconnect()');
      observer.disconnect();
    };
  }, []);

  React.useEffect(() => {
    if (c.current == null) return;
    c.current.render(data);
  }, [data]);

  return (
    <div ref={wrapperRef} className="self-stretch flex-grow overflow-hidden">
      <canvas ref={canvasRef} />
    </div>
  );
}
