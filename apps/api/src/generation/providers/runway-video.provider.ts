import { Injectable } from '@nestjs/common';
import { ProviderOutput } from './openai-image.provider';

export interface VideoGenerationInput {
  assetId: string;
  prompt: string;
  model?: string | null;
}

type RunwayTaskResponse = {
  id?: string;
  status?: string;
  output?: Array<{ url?: string }>;
  error?: string;
};

@Injectable()
export class RunwayVideoProvider {
  async generate(input: VideoGenerationInput): Promise<ProviderOutput> {
    const apiKey = process.env.RUNWAY_API_KEY;
    const model = input.model || process.env.RUNWAY_MODEL || 'runway-gen';

    if (!apiKey) {
      return {
        provider: 'runway',
        model,
        outputUrl: `https://cdn.brandpilot.local/generated/${input.assetId}.mp4`,
        thumbnailUrl: `https://cdn.brandpilot.local/generated/${input.assetId}.thumb.png`,
      };
    }

    const baseUrl = process.env.RUNWAY_API_BASE_URL || 'https://api.dev.runwayml.com/v1';
    const createResponse = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: {
          promptText: input.prompt,
        },
      }),
    });

    if (!createResponse.ok) {
      const body = await createResponse.text();
      throw new Error(`Runway task creation failed: ${createResponse.status} ${body}`);
    }

    const created = (await createResponse.json()) as RunwayTaskResponse;
    const taskId = created.id;
    if (!taskId) {
      throw new Error('Runway task id missing');
    }

    const completed = await this.pollUntilComplete(baseUrl, apiKey, taskId);
    const url = completed.output?.[0]?.url;
    if (!url) {
      throw new Error('Runway completed without output URL');
    }

    return {
      provider: 'runway',
      model,
      outputUrl: url,
      thumbnailUrl: `https://cdn.brandpilot.local/generated/${input.assetId}.thumb.png`,
      providerJobId: taskId,
    };
  }

  private async pollUntilComplete(baseUrl: string, apiKey: string, taskId: string) {
    const attempts = 30;
    for (let index = 0; index < attempts; index += 1) {
      const res = await fetch(`${baseUrl}/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Runway task poll failed: ${res.status} ${body}`);
      }

      const task = (await res.json()) as RunwayTaskResponse;
      const status = (task.status || '').toUpperCase();

      if (status === 'SUCCEEDED' || status === 'COMPLETED') {
        return task;
      }
      if (status === 'FAILED' || status === 'CANCELED' || status === 'TIMED_OUT') {
        throw new Error(task.error || `Runway task failed with status ${status}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Runway task timed out');
  }
}
