import React from "react";
import { Composition, registerRoot } from "remotion";
import {
  calculatePresentationDurationInFrames,
  PresentationVideo,
  type PresentationVideoProps,
} from "./presentation-video";

const DEFAULT_PROPS: PresentationVideoProps = {
  slides: [
    {
      imageDataUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1920'><rect width='100%25' height='100%25' fill='black'/></svg>",
      durationSeconds: 5,
      index: 0,
    },
  ],
  _width: 1080,
  _height: 1920,
  _fps: 30,
  _transitionFrames: 10,
};

function Root() {
  return (
    <Composition
      id="PresentationVideo"
      component={PresentationVideo}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={150}
      defaultProps={DEFAULT_PROPS}
      calculateMetadata={async ({ props }) => {
        const presentationProps = props as PresentationVideoProps;
        const fps = presentationProps._fps || 30;
        return {
          width: presentationProps._width || 1080,
          height: presentationProps._height || 1920,
          fps,
          durationInFrames: calculatePresentationDurationInFrames({
            slides: presentationProps.slides || [],
            fps,
            transitionFrames: presentationProps._transitionFrames,
          }),
          props,
        };
      }}
    />
  );
}

registerRoot(Root);
