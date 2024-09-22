'use client';
import clsx from 'clsx';
import * as React from 'react';

const dataToString = (data: Uint8Array): string => {
  return [...data].map((byte) => byte.toString(16).toUpperCase()).join(' ');
};

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

async function transfer(
  device: USBDevice,
  length: number = 512 * 1000,
  count = 1,
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

  return (
    <div className="p-2 gap-4 grid">
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
      <Button kind="primary" onClick={captureData}>
        Capture some{data != null ? ' more' : ''} data
      </Button>

      {data && (
        <>
          Raw data:
          <textarea value={dataToString(data)} />
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
  );
}
