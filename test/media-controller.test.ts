import { expect } from "@open-wc/testing";
import type { ReactiveController } from "lit";
import * as sinon from "sinon";
import { MediaController } from "../core/src/controllers/media-controller.js";
import type { MediaStreamChangedEventDetail } from "../core/src/utils/events.js";

class FakeHost extends EventTarget {
  _selectedDevice = { deviceId: "default" } as MediaDeviceInfo;
  addController(_controller: ReactiveController): void {}
  removeController(_controller: ReactiveController): void {}
  requestUpdate(): void {}
  readonly updateComplete = Promise.resolve(true);
}

function oscillatorStream(context: AudioContext): MediaStream {
  const oscillator = context.createOscillator();
  const destination = context.createMediaStreamDestination();
  oscillator.connect(destination);
  oscillator.start();
  return destination.stream;
}

describe("MediaController media-stream-changed", () => {
  let context: AudioContext;
  let host: FakeHost;
  let controller: MediaController;
  let streams: (MediaStream | null)[];

  beforeEach(() => {
    context = new AudioContext();
    sinon
      .stub(navigator.mediaDevices, "getUserMedia")
      .callsFake(async () => oscillatorStream(context));
    host = new FakeHost();
    controller = new MediaController(host);
    streams = [];
    host.addEventListener("media-stream-changed", (event) => {
      streams.push(
        (event as CustomEvent<MediaStreamChangedEventDetail>).detail.stream,
      );
    });
  });

  afterEach(async () => {
    await controller.cleanup();
    sinon.restore();
    await context.close();
  });

  it("publishes the recorded stream before recording starts", async () => {
    await controller.initialize();

    expect(streams).to.have.length(1);
    expect(streams[0]).to.equal(controller.mediaRecorder?.stream);
    expect(controller.mediaRecorder?.state).to.equal("inactive");
  });

  it("publishes null once when the stream is released", async () => {
    await controller.initialize();
    controller.mediaRecorder?.start();
    await controller.stopRecording();
    await controller.cleanup();
    await controller.cleanup();

    expect(streams).to.have.length(2);
    expect(streams[1]).to.equal(null);
  });

  it("releases the old stream before publishing the next one", async () => {
    await controller.initialize();
    const first = streams[0];
    await controller.initialize();

    expect(streams).to.have.length(3);
    expect(streams[1]).to.equal(null);
    expect(streams[2]).to.not.equal(first);
    expect(streams[2]).to.equal(controller.mediaRecorder?.stream);
  });

  it("publishes nothing when the microphone cannot be opened", async () => {
    (navigator.mediaDevices.getUserMedia as sinon.SinonStub).rejects(
      new DOMException("denied", "NotAllowedError"),
    );

    let error: unknown;
    try {
      await controller.initialize();
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(DOMException);
    await controller.cleanup();

    expect(streams).to.have.length(0);
  });
});
