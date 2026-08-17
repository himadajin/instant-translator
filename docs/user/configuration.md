# 設定

Instant Translator 側に設定画面や設定ファイルはない。調整できるのは `llama-server` の起動方法だけである。

## 接続先

アプリの接続先は `http://127.0.0.1:8080` に固定されている。画面から変更する手段はない。
`llama-server` の既定値がこの host と port なので、通常は次のコマンドでそのまま繋がる。

```sh
llama-server -hf LiquidAI/LFM2.5-1.2B-JP-202606-GGUF:Q8_0
```

8080 番ポートを他のプロセスが使っている場合は、そのプロセスを止める。
`llama-server` を別のポートで起動すると、アプリからは接続できない。

`llama-server` は既定で `Access-Control-Allow-Origin: *` を返すため、
ブラウザで開いたアプリからそのまま呼び出せる。この用途で CORS のオプションを足す必要はない。

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
