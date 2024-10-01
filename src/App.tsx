'use client';
import clsx from 'clsx';
import * as React from 'react';
import * as zip from '@zip.js/zip.js';
import {DataTimeline} from './DataTimeline';

function Button(
  props: JSX.IntrinsicElements['button'] & {
    kind?: 'primary' | 'secondary';
  },
) {
  return (
    <button
      {...props}
      type="button"
      className={clsx(
        props.className,
        props.kind === 'primary'
          ? 'rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
          : 'rounded bg-white px-2 py-1 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50',
      )}
    />
  );
}

function Link(props: JSX.IntrinsicElements['a']) {
  return <a {...props} className={clsx(props.className, 'underline')} />;
}

function Code(props: JSX.IntrinsicElements['code']) {
  return (
    <code
      {...props}
      className={clsx(props.className, 'bg-slate-200 rounded px-1')}
    />
  );
}

class ByteSet {
  _data = new Uint8Array(255).fill(0);
  add(idx: number) {
    this._data[idx] = 1;
  }
  toArray(): Array<number> {
    const result = [];
    for (let i = 0; i < 255; i += 1) {
      if (this._data[i] !== 0) result.push(i);
    }
    return result;
  }
}

async function transfer(
  device: USBDevice,
  length: number = 512 * 1000,
  count = 100,
) {
  const endpointNumber = 2;
  const transferPromises = [];
  for (let i = 0; i < count; i += 1) {
    transferPromises.push(device.transferIn(endpointNumber, length));
  }
  return Promise.all(transferPromises);
}

async function startAcquisition(device: USBDevice) {
  const data = new Uint8Array([
    0x00, // flags
    0x00, // sample_delay_h
    0x00, // sample_delay_l
  ]);
  const config = {
    requestType: 'vendor',
    recipient: 'device',
    request: 0xb1,
    value: 0x0000,
    index: 0x0000,
  } as const;
  return await device.controlTransferOut(config, data);
}

async function createZip(files: Record<string, Uint8Array | string>) {
  const zipWriter = new zip.ZipWriter(new zip.BlobWriter('application/zip'));

  // Add files to the zip
  for (const [filename, data] of Object.entries(files)) {
    await zipWriter.add(
      filename,
      data instanceof Uint8Array
        ? new zip.Uint8ArrayReader(data)
        : new zip.TextReader(data),
    );
  }

  // Close the writer and generate the Blob
  return await zipWriter.close();
}

async function createSigrokFile(data: Uint8Array) {
  return createZip({
    version: '2',
    metadata: [
      '[global]',
      'sigrok version=0.5.2',
      '',
      '[device 1]',
      'capturefile=logic-1',
      'total probes=8',
      'samplerate=24 MHz',
      'total analog=0',
      'probe1=D0',
      'probe2=D1',
      'probe3=D2',
      'probe4=D3',
      'probe5=D4',
      'probe6=D5',
      'probe7=D6',
      'probe8=D7',
      'unitsize=1',
    ].join('\n'),
    'logic-1-1': data,
  });
}

async function downloadBlob(blob: Blob, filename: string) {
  // Check if the File System Access API is available
  if ('showSaveFilePicker' in window) {
    try {
      // Create a file handle using the save file picker @ts-expect-error -
      // window.showSaveFilePicker may not exist
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'Sigrok Files',
            accept: {'application/octet-stream': ['.sr']},
          },
        ],
      });

      // Create a writable stream
      const writable = await fileHandle.createWritable();

      // Write the data to the file
      await writable.write(blob);

      // Close the file and save changes
      await writable.close();
    } catch (error) {
      console.error('Error saving file:', error);
    }
  } else {
    // Fallback for browsers that do not support the File System Access API
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }
}

function humanReadableSize(length: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;

  while (length >= 1024 && index < units.length - 1) {
    length /= 1024;
    index++;
  }

  return `${Math.round(length)}${units[index]}`;
}

export default function App() {
  const [data, setData] = React.useState<null | Uint8Array>();

  const captureData = async () => {
    let device;
    try {
      device = await navigator.usb.requestDevice({filters: []});
    } catch (e: unknown) {
      if (!(e instanceof Error) || e.name !== 'NotFoundError') {
        console.error(e);
      }
      setData(null);
      return;
    }

    try {
      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      transfer(device)
        .then((allResults) => {
          const length = allResults.reduce((acc, result) => {
            return acc + (result.data?.byteLength ?? 0);
          }, 0);
          const data = new Uint8Array(length);
          let i = 0;
          for (const result of allResults) {
            const resultData = result.data;
            if (resultData == null) continue;
            data.set(new Uint8Array(resultData.buffer), i);
            i += resultData.byteLength;
          }
          setData(data);
        })
        .catch((err: unknown) => {
          alert('Failed to capture; see console for details');
          console.error(err);
          setData(null);
        });

      await startAcquisition(device);
    } catch (e: unknown) {
      alert('Failed to capture stuff - see console error for details');
      console.error(e);
      setData(null);
    }
  };

  const loadData = async () => {
    const [fileHandle]: Array<FileSystemFileHandle> =
      // @ts-expect-error - window.showOpenFilePicker may not exist
      await window.showOpenFilePicker({
        types: [
          {
            description: 'Sigrok Files',
            accept: {'application/octet-stream': ['.sr']},
          },
        ],
      });

    if (!fileHandle) return;
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    const reader = new zip.ZipReader(
      new zip.Uint8ArrayReader(new Uint8Array(arrayBuffer)),
    );
    const entries = await await reader.getEntries();
    // const metadata = entries.find(f => f.filename === 'metadata');
    const logicEntry = entries.find((f) => f.filename.startsWith('logic'));
    if (logicEntry?.getData == null) {
      alert(`Unable to load logic section from ${file.name}`);
      return;
    }
    const loadedData = await logicEntry.getData(new zip.Uint8ArrayWriter());
    setData(loadedData);
  };

  const uniqueBytes = new ByteSet();
  if (data) {
    for (let i = 0; i < data.length; ++i) {
      uniqueBytes.add(data[i]!);
    }
  }

  return (
    <div className="p-2 gap-4 flex flex-col overflow-hidden">
      <p>
        <span>NOTE:</span> Only{' '}
        <Code>
          <Link href="https://github.com/wuxx/nanoDLA/blob/master/README_en.md">
            nanoDLA
          </Link>
        </Code>{' '}
        devices have been tested.
      </p>
      <p>
        Choose <Code>fx2lafw</Code> in the device UI after clicking this button:
      </p>
      <div className="flex gap-2">
        <Button kind="primary" onClick={captureData}>
          Capture some{data != null ? ' more' : ''} data
        </Button>

        <Button kind="primary" onClick={loadData}>
          Load some{data != null ? ' more' : ''} data
        </Button>

        {data && (
          <>
            <Button
              onClick={async () => {
                await downloadBlob(await createSigrokFile(data), 'data.sr');
              }}
            >
              Download data ({humanReadableSize(data.byteLength)})
            </Button>
            <Button
              onClick={() => {
                setData(null);
              }}
            >
              Clear data
            </Button>
          </>
        )}
      </div>

      {data && (
        <div>
          Unique bytes:{' '}
          {uniqueBytes
            .toArray()
            .map((n) => n.toString(16).toUpperCase())
            .join(' ')}
        </div>
      )}
      {<DataTimeline data={data ?? new Uint8Array()} />}
    </div>
  );
}
