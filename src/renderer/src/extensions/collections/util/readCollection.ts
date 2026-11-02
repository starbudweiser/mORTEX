import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import * as fs from "../../../util/fs";
import type { ICollection } from "../types/ICollection";
import { validateICollection } from "../validationCode/validation";
import { substituteRenderMods } from "./macRenderSubstitution";
import { postProcessRule } from "./postProcessRule";

function validationMessage(msg: any): string {
  return `${msg.instancePath || "/"} ${msg.message}`;
}

export interface IReadOptions {
  /** false : la collection telle que l'auteur l'a écrite, sans Bottled Shaders à la place de CS */
  substitute?: boolean;
}

export async function readCollection(
  api: IExtensionApi,
  manifest: string,
  options: IReadOptions = {},
): Promise<ICollection> {
  const collectionData = await fs.readFileAsync(manifest, {
    encoding: "utf-8",
  });
  const collection: ICollection = JSON.parse(collectionData);
  const readErrors = validateICollection(collection);
  if (readErrors.length > 0) {
    api.showErrorNotification(
      "Collection validation mismatch",
      "There was a validation issue with this collection. " +
        "During the testing phase, this is likely caused by the checks being too strict and " +
        "the collection itself should still work correctly.\n" +
        "To help us improve the validation, please report this error once on each " +
        "collection it appears for.\n\n" +
        readErrors.map(validationMessage).join("\n"),
    );
    /*
    throw new util.ProcessCanceled(
      'Collection invalid:\n' + ,
      readErrors.map(validationMessage));
    */
  }
  collection.modRules = (collection.modRules ?? []).map((rule) => postProcessRule(rule));

  if (options.substitute === false) {
    return collection;
  }
  try {
    // mORTEX (macOS) : Bottled Shaders à la place du Community Shaders d'origine, en un seul point
    // pour toutes les lectures (installation, mise à jour, règles, informations)
    return (await substituteRenderMods(api, collection, manifest)) ?? collection;
  } catch (err) {
    log("warn", "render mod substitution failed, reading the collection as is", {
      error: getErrorMessageOrDefault(err),
    });
    return collection;
  }
}
