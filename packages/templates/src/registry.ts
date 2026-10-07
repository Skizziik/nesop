import type { FormatId, RenderProps } from "./generated";
import { ListMystery } from "./formats/ListMystery";

export type FormatComponent = React.FC<{ props: RenderProps }>;

/** Реализованные форматы. Новые добавляются сюда + schemas/formats/<id>.schema.json + services/api/app/formats/<id>.py */
export const FORMAT_COMPONENTS: Partial<Record<FormatId, FormatComponent>> = {
  list_mystery: ListMystery,
};

export const IMPLEMENTED_FORMATS = Object.keys(FORMAT_COMPONENTS) as FormatId[];
