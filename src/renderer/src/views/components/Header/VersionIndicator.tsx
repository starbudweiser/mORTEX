import React, { type FC } from "react";

import { Typography } from "../../../ui/components/typography/Typography";
import { getApplication } from "../../../util/application";

export const VersionIndicator: FC<React.PropsWithChildren<unknown>> = () => {
  const version = getApplication().version;
  const formattedVersion = `v${version}`;

  return (
    <Typography
      appearance="weak"
      brand="neutral-translucent"
      className="text-[#38bdf8]!"
      data-testid="version-indicator"
      typographyType="body-sm"
    >
      {formattedVersion}
    </Typography>
  );
};
