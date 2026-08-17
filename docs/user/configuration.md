# 設定

Instant Translator に設定画面はない。接続先ポートは環境変数 `VITE_INFERENCE_PORT` で変えられる。
それ以外の調整は `llama-server` の起動方法である。

## 接続先

ホストは `127.0.0.1` に固定されている。画面から変更する手段はない。
ポートの既定は `8080` で、`llama-server` の既定と同じである。通常は次のコマンドでそのまま繋がる。

```sh
llama-server -hf LiquidAI/LFM2.5-1.2B-JP-202606-GGUF:Q8_0
```

別のポートで `llama-server` を待つ場合は、アプリ側も同じポートにする。
リポジトリ直下の `.env.example` を `.env` または `.env.local` にコピーし、`VITE_INFERENCE_PORT` を書き換える。

```
VITE_INFERENCE_PORT=8081
```

`llama-server` 側も揃える。

```sh
llama-server --port 8081 -hf LiquidAI/LFM2.5-1.2B-JP-202606-GGUF:Q8_0
```

変更を反映するには `npm run dev` を再起動する。
未設定のときは `8080` を使う。空や整数でない値、`1` から `65535` の範囲外はアプリ起動時に失敗する。

`llama.cpp` の既定設定はローカル Web アプリから利用できるため、この用途で追加の CORS オプションを
指定する必要はない。

## 量子化を選ぶ

既定は 8-bit 相当の `Q8_0` である。`-hf` の `:` 以降で量子化を指定する。
指定を省くと `Q4_K_M` が選ばれるため、既定で使うときも `:Q8_0` を明示する。

[モデルのリポジトリ](https://huggingface.co/LiquidAI/LFM2.5-1.2B-JP-202606-GGUF)には
`F16`、`Q8_0`、`Q6_K`、`Q5_K_M`、`Q4_K_M`、`Q4_0` がある。
量子化を軽くするとメモリ使用量は減るが、翻訳品質は落ちる。

ダウンロード済みのモデルファイルを直接指定することもできる。

```sh
llama-server -m /path/to/LFM2.5-1.2B-JP-202606-Q8_0.gguf
```

`-hf` で取得したモデルの保存先は、環境変数 `LLAMA_CACHE` で変えられる。

## その他の起動オプション

`llama-server` のオプション一覧は次で確認できる。

```sh
llama-server --help
```
