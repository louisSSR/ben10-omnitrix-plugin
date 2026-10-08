#!/system/bin/sh
# Run inside SillyDroid's own Settings > Terminal, not a separate Termux app.
set -eu
case "${1:-}" in
  ''|--apply) ;;
  *) printf '%s\n' '参数只支持 --apply；不带参数仅预检。' >&2; exit 2 ;;
esac
[ "$#" -le 1 ] || exit 2
: "${APP_DATA_ROOT:?请在 SillyDroid 原生设置 > 终端中运行}"
: "${HOST_TMP_DIR:?缺少 SillyDroid HOST_TMP_DIR}"
: "${TERMUX_NODE_BIN:?缺少 SillyDroid Node 入口}"
: "${TERMUX_CURL_BIN:?缺少 SillyDroid curl 入口}"
omni_tmp=$(mktemp -d "$HOST_TMP_DIR/omnitrix-install.XXXXXXXX")
trap 'rm -f "$omni_tmp/mobile-install.mjs"; rmdir "$omni_tmp" 2>/dev/null || true' EXIT HUP INT TERM
"$TERMUX_CURL_BIN" --fail --silent --show-error --proto '=https' --tlsv1.2 --max-time 90 \
  'https://raw.githubusercontent.com/louisSSR/ben10-omnitrix-plugin/main/scripts/mobile-install.mjs' \
  --output "$omni_tmp/mobile-install.mjs"
"$TERMUX_NODE_BIN" "$omni_tmp/mobile-install.mjs" "$@"
