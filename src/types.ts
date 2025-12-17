export type PickedColor =
{
  input: string;
  hex: string;
  srgb8bit: readonly
  [
    number,
    number,
    number,
  ];
};

export type ContrastResults =
{
  wcagRatio: number;
  apca: number;
};

export type PixelPickResult =
{
  foreground:
  {
    x: number;
    y: number;
    hex: string;
  };
  background:
  {
    x: number;
    y: number;
    hex: string;
  };
};
