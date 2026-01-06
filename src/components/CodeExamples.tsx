import { useState, useMemo, useEffect } from 'react';

declare global {
  interface Window {
    Prism?: {
      highlightAll: () => void;
    };
  }
}

const API_BASE = 'https://lyrics-api.boidu.dev';

type Language = 'curl' | 'javascript' | 'typescript' | 'python' | 'go' | 'swift' | 'kotlin';

interface CodeExamplesProps {
  song: string;
  artist: string;
  album?: string;
  duration?: string;
  provider?: 'ttml' | 'kugou' | 'legacy';
}

const PROVIDER_ENDPOINTS: Record<string, string> = {
  ttml: '/getLyrics',
  kugou: '/kugou/getLyrics',
  legacy: '/legacy/getLyrics',
};

export default function CodeExamples({
  song,
  artist,
  album,
  duration,
  provider = 'ttml',
}: CodeExamplesProps) {
  const [activeTab, setActiveTab] = useState<Language>('curl');
  const [copied, setCopied] = useState(false);

  const endpoint = PROVIDER_ENDPOINTS[provider] || '/getLyrics';

  const buildParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (song) params.s = song;
    if (artist) params.a = artist;
    if (album) params.al = album;
    if (duration) params.d = duration;
    return params;
  }, [song, artist, album, duration]);

  const buildQueryString = () => {
    return new URLSearchParams(buildParams).toString();
  };

  const fullUrl = `${API_BASE}${endpoint}?${buildQueryString()}`;

  const examples: Record<Language, string> = useMemo(
    () => ({
      curl: `curl "${fullUrl}"`,

      javascript: `const params = new URLSearchParams({
${Object.entries(buildParams)
  .map(([k, v]) => `  ${k}: "${v}"`)
  .join(',\n')}
});

const response = await fetch(\`${API_BASE}${endpoint}?\${params}\`);
const data = await response.json();

if (response.ok) {
  console.log(data.ttml);
} else {
  console.error(data.error);
}`,

      typescript: `interface LyricsResponse {
  ttml: string;
  score?: number;
}

interface ErrorResponse {
  error: string;
  message?: string;
}

const params = new URLSearchParams({
${Object.entries(buildParams)
  .map(([k, v]) => `  ${k}: "${v}"`)
  .join(',\n')}
});

const response = await fetch(\`${API_BASE}${endpoint}?\${params}\`);

if (response.ok) {
  const data: LyricsResponse = await response.json();
  console.log(data.ttml);
} else {
  const error: ErrorResponse = await response.json();
  console.error(error.message ?? error.error);
}`,

      python: `import requests

response = requests.get(
    "${API_BASE}${endpoint}",
    params={
${Object.entries(buildParams)
  .map(([k, v]) => `        "${k}": "${v}"`)
  .join(',\n')}
    }
)

if response.ok:
    data = response.json()
    print(data["ttml"])
else:
    error = response.json()
    print(f"Error: {error.get('error')}")`,

      go: `package main

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "net/url"
)

func main() {
    baseURL := "${API_BASE}${endpoint}"
    params := url.Values{}
${Object.entries(buildParams)
  .map(([k, v]) => `    params.Add("${k}", "${v}")`)
  .join('\n')}

    resp, err := http.Get(baseURL + "?" + params.Encode())
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)

    var result map[string]interface{}
    json.Unmarshal(body, &result)

    if resp.StatusCode == 200 {
        fmt.Println(result["ttml"])
    } else {
        fmt.Printf("Error: %v\\n", result["error"])
    }
}`,

      swift: `import Foundation

let url = URL(string: "${fullUrl.replace(/"/g, '\\"')}")!

let task = URLSession.shared.dataTask(with: url) { data, response, error in
    guard let data = data,
          let httpResponse = response as? HTTPURLResponse else {
        print("Error: \\(error?.localizedDescription ?? "Unknown error")")
        return
    }

    if httpResponse.statusCode == 200 {
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let ttml = json["ttml"] as? String {
            print(ttml)
        }
    } else {
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let error = json["error"] as? String {
            print("Error: \\(error)")
        }
    }
}

task.resume()`,

      kotlin: `import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

val client = OkHttpClient()

val url = "${API_BASE}${endpoint}".toHttpUrl().newBuilder()
${Object.entries(buildParams)
  .map(([k, v]) => `    .addQueryParameter("${k}", "${v}")`)
  .join('\n')}
    .build()

val request = Request.Builder()
    .url(url)
    .build()

client.newCall(request).execute().use { response ->
    val body = response.body?.string() ?: return@use
    val json = JSONObject(body)

    if (response.isSuccessful) {
        println(json.getString("ttml"))
    } else {
        println("Error: \${json.getString("error")}")
    }
}`,
    }),
    [fullUrl, buildParams, endpoint]
  );

  // Trigger Prism highlighting when content changes
  useEffect(() => {
    if (window.Prism) {
      window.Prism.highlightAll();
    }
  }, [activeTab, examples]);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(examples[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const languages: { id: Language; label: string }[] = [
    { id: 'curl', label: 'curl' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'python', label: 'Python' },
    { id: 'go', label: 'Go' },
    { id: 'swift', label: 'Swift' },
    { id: 'kotlin', label: 'Kotlin' },
  ];

  return (
    <div className="code-examples">
      <div className="tabs-header">
        <div className="tabs">
          {languages.map((lang) => (
            <button
              key={lang.id}
              className={`tab ${activeTab === lang.id ? 'active' : ''}`}
              onClick={() => setActiveTab(lang.id)}
            >
              {lang.label}
            </button>
          ))}
        </div>
        <button className="copy-btn" onClick={copyToClipboard}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="code-content">
        <code className={`language-${activeTab === 'curl' ? 'bash' : activeTab}`}>
          {examples[activeTab]}
        </code>
      </pre>

      <style>{`
        .code-examples {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          margin-top: var(--space-6);
        }

        .tabs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-2) var(--space-4);
          border-bottom: 1px solid var(--border);
          background-color: var(--bg-tertiary);
          overflow-x: auto;
        }

        .tabs {
          display: flex;
          gap: var(--space-1);
        }

        .tab {
          padding: var(--space-2) var(--space-3);
          font-size: 0.8125rem;
          font-weight: 500;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }

        .tab:hover {
          color: var(--text-secondary);
          background-color: var(--bg-secondary);
        }

        .tab.active {
          color: var(--text-primary);
          background-color: var(--bg-secondary);
        }

        .copy-btn {
          padding: var(--space-1) var(--space-3);
          font-size: 0.75rem;
          font-weight: 500;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }

        .copy-btn:hover {
          border-color: var(--border-hover);
          color: var(--text-secondary);
        }

        .code-examples .code-content {
          margin: 0;
          padding: var(--space-4);
          font-size: 0.8125rem;
          background-color: var(--bg-primary);
          border: none;
          border-radius: 0 0 var(--radius-lg) var(--radius-lg);
          max-height: 400px;
          overflow: auto;
        }

        .code-examples .code-content code {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          font-size: 0.8125rem;
          font-family: var(--font-mono);
          line-height: 1.6;
          display: block;
        }
      `}</style>
    </div>
  );
}
