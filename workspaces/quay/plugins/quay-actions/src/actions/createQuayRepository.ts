/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

import { examples } from './quay-actions.examples';

export interface ResponseBody {
  namespace: string;
  name: string;
  kind: string;
}
export interface ResponseErrorBody {
  detail: string;
  error_message: string;
  error_type: string;
  title: string;
  type: string;
  status: number;
}
interface RequestBody {
  repository: string;
  visibility: string;
  namespace?: string;
  description: string;
  repo_kind?: string;
}

/**
 * @public
 */
export type TemplateActionParameters = {
  name: string;
  visibility: string;
  description: string;
  token: string;
  baseUrl?: string;
  namespace?: string;
  repoKind?: string;
};

const getUrl = (url: string | undefined): string => {
  if (!url) {
    return 'https://quay.io';
  }
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch (error) {
    throw new Error('"baseUrl" is invalid');
  }
  return url;
};

const isValueValid = (
  value: string | undefined,
  valueName: string,
  valueOpts: Array<string | undefined>,
) => {
  if (valueOpts.includes(value)) {
    return;
  }
  throw new Error(
    `For the "${valueName}" parameter "${value}" is not a valid option,` +
      ` available options are: ${valueOpts.map(v => v || 'none').join(', ')}`,
  );
};

/**
 * @public
 */
export function createQuayRepositoryAction() {
  return createTemplateAction({
    id: 'quay:create-repository',
    examples,
    description: 'Create an quay image repository',
    schema: {
      input: {
        name: z => z.string().describe('Name of the repository to be created'),
        visibility: z =>
          z
            .string()
            .describe(
              'Visibility setting for the created repository, either public or private',
            ),
        description: z => z.string().describe('The repository description'),
        token: z => z.string().describe('Bearer token used for authorization'),
        baseUrl: z =>
          z
            .string()
            .optional()
            .describe(
              'URL of your quay instance, set to "https://quay.io" by default',
            ),
        namespace: z =>
          z
            .string()
            .optional()
            .describe(
              'Namespace in which to create the repository, by default the users namespace',
            ),
        repoKind: z =>
          z
            .string()
            .optional()
            .describe(
              'The created repository type either image or an application, if empty image will be used',
            ),
      },
      output: {
        repositoryUrl: z => z.string().describe('Created repository URL link'),
      },
    },
    async handler(ctx) {
      const { token, name, visibility, namespace, description, repoKind } =
        ctx.input;
      const baseUrl = getUrl(ctx.input.baseUrl);
      isValueValid(visibility, 'visibility', ['public', 'private']);
      isValueValid(repoKind, 'repository kind', [
        'application',
        'image',
        undefined,
      ]);

      const params: RequestBody = {
        description,
        repository: name,
        visibility,
        namespace,
        repo_kind: repoKind,
      };

      const uri = encodeURI(`${baseUrl}/api/v1/repository`);
      const response = await fetch(uri, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
        method: 'POST',
      });

      if (!response.ok) {
        const errorBody = (await response.json()) as ResponseErrorBody;
        const errorStatus = errorBody.status || response.status;
        // Some error responses don't have the structure defined in ResponseErrorBody
        const errorMsg = errorBody.detail || (errorBody as any).error;
        throw new Error(
          `Failed to create Quay repository, ${errorStatus} -- ${errorMsg}`,
        );
      }

      const body = (await response.json()) as ResponseBody;
      ctx.output(
        'repositoryUrl',
        `${baseUrl}/repository/${body.namespace}/${body.name}`,
      );
    },
  });
}
