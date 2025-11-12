// node_modules/pako/dist/pako.esm.mjs
var Z_FIXED$1 = 4;
var Z_BINARY = 0;
var Z_TEXT = 1;
var Z_UNKNOWN$1 = 2;
function zero$1(buf) {
  let len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
}
var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES = 2;
var MIN_MATCH$1 = 3;
var MAX_MATCH$1 = 258;
var LENGTH_CODES$1 = 29;
var LITERALS$1 = 256;
var L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1;
var D_CODES$1 = 30;
var BL_CODES$1 = 19;
var HEAP_SIZE$1 = 2 * L_CODES$1 + 1;
var MAX_BITS$1 = 15;
var Buf_size = 16;
var MAX_BL_BITS = 7;
var END_BLOCK = 256;
var REP_3_6 = 16;
var REPZ_3_10 = 17;
var REPZ_11_138 = 18;
var extra_lbits = (
  /* extra bits for each length code */
  new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0])
);
var extra_dbits = (
  /* extra bits for each distance code */
  new Uint8Array([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13])
);
var extra_blbits = (
  /* extra bits for each bit length code */
  new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7])
);
var bl_order = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var DIST_CODE_LEN = 512;
var static_ltree = new Array((L_CODES$1 + 2) * 2);
zero$1(static_ltree);
var static_dtree = new Array(D_CODES$1 * 2);
zero$1(static_dtree);
var _dist_code = new Array(DIST_CODE_LEN);
zero$1(_dist_code);
var _length_code = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1);
zero$1(_length_code);
var base_length = new Array(LENGTH_CODES$1);
zero$1(base_length);
var base_dist = new Array(D_CODES$1);
zero$1(base_dist);
function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
  this.static_tree = static_tree;
  this.extra_bits = extra_bits;
  this.extra_base = extra_base;
  this.elems = elems;
  this.max_length = max_length;
  this.has_stree = static_tree && static_tree.length;
}
var static_l_desc;
var static_d_desc;
var static_bl_desc;
function TreeDesc(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree;
  this.max_code = 0;
  this.stat_desc = stat_desc;
}
var d_code = (dist) => {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
};
var put_short = (s, w) => {
  s.pending_buf[s.pending++] = w & 255;
  s.pending_buf[s.pending++] = w >>> 8 & 255;
};
var send_bits = (s, value, length) => {
  if (s.bi_valid > Buf_size - length) {
    s.bi_buf |= value << s.bi_valid & 65535;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> Buf_size - s.bi_valid;
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= value << s.bi_valid & 65535;
    s.bi_valid += length;
  }
};
var send_code = (s, c, tree) => {
  send_bits(
    s,
    tree[c * 2],
    tree[c * 2 + 1]
    /*.Len*/
  );
};
var bi_reverse = (code, len) => {
  let res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
};
var bi_flush = (s) => {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;
  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 255;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
};
var gen_bitlen = (s, desc) => {
  const tree = desc.dyn_tree;
  const max_code = desc.max_code;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const extra = desc.stat_desc.extra_bits;
  const base = desc.stat_desc.extra_base;
  const max_length = desc.stat_desc.max_length;
  let h;
  let n, m;
  let bits;
  let xbits;
  let f;
  let overflow = 0;
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    s.bl_count[bits] = 0;
  }
  tree[s.heap[s.heap_max] * 2 + 1] = 0;
  for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
    n = s.heap[h];
    bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n * 2 + 1] = bits;
    if (n > max_code) {
      continue;
    }
    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) {
      xbits = extra[n - base];
    }
    f = tree[n * 2];
    s.opt_len += f * (bits + xbits);
    if (has_stree) {
      s.static_len += f * (stree[n * 2 + 1] + xbits);
    }
  }
  if (overflow === 0) {
    return;
  }
  do {
    bits = max_length - 1;
    while (s.bl_count[bits] === 0) {
      bits--;
    }
    s.bl_count[bits]--;
    s.bl_count[bits + 1] += 2;
    s.bl_count[max_length]--;
    overflow -= 2;
  } while (overflow > 0);
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) {
        continue;
      }
      if (tree[m * 2 + 1] !== bits) {
        s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
        tree[m * 2 + 1] = bits;
      }
      n--;
    }
  }
};
var gen_codes = (tree, max_code, bl_count) => {
  const next_code = new Array(MAX_BITS$1 + 1);
  let code = 0;
  let bits;
  let n;
  for (bits = 1; bits <= MAX_BITS$1; bits++) {
    code = code + bl_count[bits - 1] << 1;
    next_code[bits] = code;
  }
  for (n = 0; n <= max_code; n++) {
    let len = tree[n * 2 + 1];
    if (len === 0) {
      continue;
    }
    tree[n * 2] = bi_reverse(next_code[len]++, len);
  }
};
var tr_static_init = () => {
  let n;
  let bits;
  let length;
  let code;
  let dist;
  const bl_count = new Array(MAX_BITS$1 + 1);
  length = 0;
  for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
    base_length[code] = length;
    for (n = 0; n < 1 << extra_lbits[code]; n++) {
      _length_code[length++] = code;
    }
  }
  _length_code[length - 1] = code;
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < 1 << extra_dbits[code]; n++) {
      _dist_code[dist++] = code;
    }
  }
  dist >>= 7;
  for (; code < D_CODES$1; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < 1 << extra_dbits[code] - 7; n++) {
      _dist_code[256 + dist++] = code;
    }
  }
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    bl_count[bits] = 0;
  }
  n = 0;
  while (n <= 143) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1] = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1] = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  gen_codes(static_ltree, L_CODES$1 + 1, bl_count);
  for (n = 0; n < D_CODES$1; n++) {
    static_dtree[n * 2 + 1] = 5;
    static_dtree[n * 2] = bi_reverse(n, 5);
  }
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS$1 + 1, L_CODES$1, MAX_BITS$1);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES$1, MAX_BITS$1);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES$1, MAX_BL_BITS);
};
var init_block = (s) => {
  let n;
  for (n = 0; n < L_CODES$1; n++) {
    s.dyn_ltree[n * 2] = 0;
  }
  for (n = 0; n < D_CODES$1; n++) {
    s.dyn_dtree[n * 2] = 0;
  }
  for (n = 0; n < BL_CODES$1; n++) {
    s.bl_tree[n * 2] = 0;
  }
  s.dyn_ltree[END_BLOCK * 2] = 1;
  s.opt_len = s.static_len = 0;
  s.sym_next = s.matches = 0;
};
var bi_windup = (s) => {
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf);
  } else if (s.bi_valid > 0) {
    s.pending_buf[s.pending++] = s.bi_buf;
  }
  s.bi_buf = 0;
  s.bi_valid = 0;
};
var smaller = (tree, n, m, depth) => {
  const _n2 = n * 2;
  const _m2 = m * 2;
  return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
};
var pqdownheap = (s, tree, k) => {
  const v = s.heap[k];
  let j = k << 1;
  while (j <= s.heap_len) {
    if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
      j++;
    }
    if (smaller(tree, v, s.heap[j], s.depth)) {
      break;
    }
    s.heap[k] = s.heap[j];
    k = j;
    j <<= 1;
  }
  s.heap[k] = v;
};
var compress_block = (s, ltree, dtree) => {
  let dist;
  let lc;
  let sx = 0;
  let code;
  let extra;
  if (s.sym_next !== 0) {
    do {
      dist = s.pending_buf[s.sym_buf + sx++] & 255;
      dist += (s.pending_buf[s.sym_buf + sx++] & 255) << 8;
      lc = s.pending_buf[s.sym_buf + sx++];
      if (dist === 0) {
        send_code(s, lc, ltree);
      } else {
        code = _length_code[lc];
        send_code(s, code + LITERALS$1 + 1, ltree);
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra);
        }
        dist--;
        code = d_code(dist);
        send_code(s, code, dtree);
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra);
        }
      }
    } while (sx < s.sym_next);
  }
  send_code(s, END_BLOCK, ltree);
};
var build_tree = (s, desc) => {
  const tree = desc.dyn_tree;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const elems = desc.stat_desc.elems;
  let n, m;
  let max_code = -1;
  let node;
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE$1;
  for (n = 0; n < elems; n++) {
    if (tree[n * 2] !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;
    } else {
      tree[n * 2 + 1] = 0;
    }
  }
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
    tree[node * 2] = 1;
    s.depth[node] = 0;
    s.opt_len--;
    if (has_stree) {
      s.static_len -= stree[node * 2 + 1];
    }
  }
  desc.max_code = max_code;
  for (n = s.heap_len >> 1; n >= 1; n--) {
    pqdownheap(s, tree, n);
  }
  node = elems;
  do {
    n = s.heap[
      1
      /*SMALLEST*/
    ];
    s.heap[
      1
      /*SMALLEST*/
    ] = s.heap[s.heap_len--];
    pqdownheap(
      s,
      tree,
      1
      /*SMALLEST*/
    );
    m = s.heap[
      1
      /*SMALLEST*/
    ];
    s.heap[--s.heap_max] = n;
    s.heap[--s.heap_max] = m;
    tree[node * 2] = tree[n * 2] + tree[m * 2];
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1] = tree[m * 2 + 1] = node;
    s.heap[
      1
      /*SMALLEST*/
    ] = node++;
    pqdownheap(
      s,
      tree,
      1
      /*SMALLEST*/
    );
  } while (s.heap_len >= 2);
  s.heap[--s.heap_max] = s.heap[
    1
    /*SMALLEST*/
  ];
  gen_bitlen(s, desc);
  gen_codes(tree, max_code, s.bl_count);
};
var scan_tree = (s, tree, max_code) => {
  let n;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[0 * 2 + 1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1] = 65535;
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      s.bl_tree[curlen * 2] += count;
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        s.bl_tree[curlen * 2]++;
      }
      s.bl_tree[REP_3_6 * 2]++;
    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10 * 2]++;
    } else {
      s.bl_tree[REPZ_11_138 * 2]++;
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
var send_tree = (s, tree, max_code) => {
  let n;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[0 * 2 + 1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      do {
        send_code(s, curlen, s.bl_tree);
      } while (--count !== 0);
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count - 3, 2);
    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count - 3, 3);
    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count - 11, 7);
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
var build_bl_tree = (s) => {
  let max_blindex;
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
  build_tree(s, s.bl_desc);
  for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
      break;
    }
  }
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  return max_blindex;
};
var send_all_trees = (s, lcodes, dcodes, blcodes) => {
  let rank2;
  send_bits(s, lcodes - 257, 5);
  send_bits(s, dcodes - 1, 5);
  send_bits(s, blcodes - 4, 4);
  for (rank2 = 0; rank2 < blcodes; rank2++) {
    send_bits(s, s.bl_tree[bl_order[rank2] * 2 + 1], 3);
  }
  send_tree(s, s.dyn_ltree, lcodes - 1);
  send_tree(s, s.dyn_dtree, dcodes - 1);
};
var detect_data_type = (s) => {
  let block_mask = 4093624447;
  let n;
  for (n = 0; n <= 31; n++, block_mask >>>= 1) {
    if (block_mask & 1 && s.dyn_ltree[n * 2] !== 0) {
      return Z_BINARY;
    }
  }
  if (s.dyn_ltree[9 * 2] !== 0 || s.dyn_ltree[10 * 2] !== 0 || s.dyn_ltree[13 * 2] !== 0) {
    return Z_TEXT;
  }
  for (n = 32; n < LITERALS$1; n++) {
    if (s.dyn_ltree[n * 2] !== 0) {
      return Z_TEXT;
    }
  }
  return Z_BINARY;
};
var static_init_done = false;
var _tr_init$1 = (s) => {
  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }
  s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
  s.bi_buf = 0;
  s.bi_valid = 0;
  init_block(s);
};
var _tr_stored_block$1 = (s, buf, stored_len, last) => {
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
  bi_windup(s);
  put_short(s, stored_len);
  put_short(s, ~stored_len);
  if (stored_len) {
    s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
  }
  s.pending += stored_len;
};
var _tr_align$1 = (s) => {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
};
var _tr_flush_block$1 = (s, buf, stored_len, last) => {
  let opt_lenb, static_lenb;
  let max_blindex = 0;
  if (s.level > 0) {
    if (s.strm.data_type === Z_UNKNOWN$1) {
      s.strm.data_type = detect_data_type(s);
    }
    build_tree(s, s.l_desc);
    build_tree(s, s.d_desc);
    max_blindex = build_bl_tree(s);
    opt_lenb = s.opt_len + 3 + 7 >>> 3;
    static_lenb = s.static_len + 3 + 7 >>> 3;
    if (static_lenb <= opt_lenb) {
      opt_lenb = static_lenb;
    }
  } else {
    opt_lenb = static_lenb = stored_len + 5;
  }
  if (stored_len + 4 <= opt_lenb && buf !== -1) {
    _tr_stored_block$1(s, buf, stored_len, last);
  } else if (s.strategy === Z_FIXED$1 || static_lenb === opt_lenb) {
    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);
  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  init_block(s);
  if (last) {
    bi_windup(s);
  }
};
var _tr_tally$1 = (s, dist, lc) => {
  s.pending_buf[s.sym_buf + s.sym_next++] = dist;
  s.pending_buf[s.sym_buf + s.sym_next++] = dist >> 8;
  s.pending_buf[s.sym_buf + s.sym_next++] = lc;
  if (dist === 0) {
    s.dyn_ltree[lc * 2]++;
  } else {
    s.matches++;
    dist--;
    s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2]++;
    s.dyn_dtree[d_code(dist) * 2]++;
  }
  return s.sym_next === s.sym_end;
};
var _tr_init_1 = _tr_init$1;
var _tr_stored_block_1 = _tr_stored_block$1;
var _tr_flush_block_1 = _tr_flush_block$1;
var _tr_tally_1 = _tr_tally$1;
var _tr_align_1 = _tr_align$1;
var trees = {
  _tr_init: _tr_init_1,
  _tr_stored_block: _tr_stored_block_1,
  _tr_flush_block: _tr_flush_block_1,
  _tr_tally: _tr_tally_1,
  _tr_align: _tr_align_1
};
var adler32 = (adler, buf, len, pos) => {
  let s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
  while (len !== 0) {
    n = len > 2e3 ? 2e3 : len;
    len -= n;
    do {
      s1 = s1 + buf[pos++] | 0;
      s2 = s2 + s1 | 0;
    } while (--n);
    s1 %= 65521;
    s2 %= 65521;
  }
  return s1 | s2 << 16 | 0;
};
var adler32_1 = adler32;
var makeTable = () => {
  let c, table = [];
  for (var n = 0; n < 256; n++) {
    c = n;
    for (var k = 0; k < 8; k++) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    table[n] = c;
  }
  return table;
};
var crcTable = new Uint32Array(makeTable());
var crc32 = (crc, buf, len, pos) => {
  const t = crcTable;
  const end = pos + len;
  crc ^= -1;
  for (let i = pos; i < end; i++) {
    crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
  }
  return crc ^ -1;
};
var crc32_1 = crc32;
var messages = {
  2: "need dictionary",
  /* Z_NEED_DICT       2  */
  1: "stream end",
  /* Z_STREAM_END      1  */
  0: "",
  /* Z_OK              0  */
  "-1": "file error",
  /* Z_ERRNO         (-1) */
  "-2": "stream error",
  /* Z_STREAM_ERROR  (-2) */
  "-3": "data error",
  /* Z_DATA_ERROR    (-3) */
  "-4": "insufficient memory",
  /* Z_MEM_ERROR     (-4) */
  "-5": "buffer error",
  /* Z_BUF_ERROR     (-5) */
  "-6": "incompatible version"
  /* Z_VERSION_ERROR (-6) */
};
var constants$2 = {
  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_TREES: 6,
  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_ERRNO: -1,
  Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3,
  Z_MEM_ERROR: -4,
  Z_BUF_ERROR: -5,
  //Z_VERSION_ERROR: -6,
  /* compression levels */
  Z_NO_COMPRESSION: 0,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,
  Z_FILTERED: 1,
  Z_HUFFMAN_ONLY: 2,
  Z_RLE: 3,
  Z_FIXED: 4,
  Z_DEFAULT_STRATEGY: 0,
  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY: 0,
  Z_TEXT: 1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN: 2,
  /* The deflate compression method */
  Z_DEFLATED: 8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};
var { _tr_init, _tr_stored_block, _tr_flush_block, _tr_tally, _tr_align } = trees;
var {
  Z_NO_FLUSH: Z_NO_FLUSH$2,
  Z_PARTIAL_FLUSH,
  Z_FULL_FLUSH: Z_FULL_FLUSH$1,
  Z_FINISH: Z_FINISH$3,
  Z_BLOCK: Z_BLOCK$1,
  Z_OK: Z_OK$3,
  Z_STREAM_END: Z_STREAM_END$3,
  Z_STREAM_ERROR: Z_STREAM_ERROR$2,
  Z_DATA_ERROR: Z_DATA_ERROR$2,
  Z_BUF_ERROR: Z_BUF_ERROR$1,
  Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION$1,
  Z_FILTERED,
  Z_HUFFMAN_ONLY,
  Z_RLE,
  Z_FIXED,
  Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY$1,
  Z_UNKNOWN,
  Z_DEFLATED: Z_DEFLATED$2
} = constants$2;
var MAX_MEM_LEVEL = 9;
var MAX_WBITS$1 = 15;
var DEF_MEM_LEVEL = 8;
var LENGTH_CODES = 29;
var LITERALS = 256;
var L_CODES = LITERALS + 1 + LENGTH_CODES;
var D_CODES = 30;
var BL_CODES = 19;
var HEAP_SIZE = 2 * L_CODES + 1;
var MAX_BITS = 15;
var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
var PRESET_DICT = 32;
var INIT_STATE = 42;
var GZIP_STATE = 57;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;
var BS_NEED_MORE = 1;
var BS_BLOCK_DONE = 2;
var BS_FINISH_STARTED = 3;
var BS_FINISH_DONE = 4;
var OS_CODE = 3;
var err = (strm, errorCode) => {
  strm.msg = messages[errorCode];
  return errorCode;
};
var rank = (f) => {
  return f * 2 - (f > 4 ? 9 : 0);
};
var zero = (buf) => {
  let len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
};
var slide_hash = (s) => {
  let n, m;
  let p;
  let wsize = s.w_size;
  n = s.hash_size;
  p = n;
  do {
    m = s.head[--p];
    s.head[p] = m >= wsize ? m - wsize : 0;
  } while (--n);
  n = wsize;
  p = n;
  do {
    m = s.prev[--p];
    s.prev[p] = m >= wsize ? m - wsize : 0;
  } while (--n);
};
var HASH_ZLIB = (s, prev, data) => (prev << s.hash_shift ^ data) & s.hash_mask;
var HASH = HASH_ZLIB;
var flush_pending = (strm) => {
  const s = strm.state;
  let len = s.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) {
    return;
  }
  strm.output.set(s.pending_buf.subarray(s.pending_out, s.pending_out + len), strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0) {
    s.pending_out = 0;
  }
};
var flush_block_only = (s, last) => {
  _tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
};
var put_byte = (s, b) => {
  s.pending_buf[s.pending++] = b;
};
var putShortMSB = (s, b) => {
  s.pending_buf[s.pending++] = b >>> 8 & 255;
  s.pending_buf[s.pending++] = b & 255;
};
var read_buf = (strm, buf, start, size) => {
  let len = strm.avail_in;
  if (len > size) {
    len = size;
  }
  if (len === 0) {
    return 0;
  }
  strm.avail_in -= len;
  buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32_1(strm.adler, buf, len, start);
  } else if (strm.state.wrap === 2) {
    strm.adler = crc32_1(strm.adler, buf, len, start);
  }
  strm.next_in += len;
  strm.total_in += len;
  return len;
};
var longest_match = (s, cur_match) => {
  let chain_length = s.max_chain_length;
  let scan = s.strstart;
  let match;
  let len;
  let best_len = s.prev_length;
  let nice_match = s.nice_match;
  const limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
  const _win = s.window;
  const wmask = s.w_mask;
  const prev = s.prev;
  const strend = s.strstart + MAX_MATCH;
  let scan_end1 = _win[scan + best_len - 1];
  let scan_end = _win[scan + best_len];
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2;
  }
  if (nice_match > s.lookahead) {
    nice_match = s.lookahead;
  }
  do {
    match = cur_match;
    if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
      continue;
    }
    scan += 2;
    match++;
    do {
    } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;
    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1 = _win[scan + best_len - 1];
      scan_end = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
  if (best_len <= s.lookahead) {
    return best_len;
  }
  return s.lookahead;
};
var fill_window = (s) => {
  const _w_size = s.w_size;
  let n, more, str;
  do {
    more = s.window_size - s.lookahead - s.strstart;
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
      s.window.set(s.window.subarray(_w_size, _w_size + _w_size - more), 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      s.block_start -= _w_size;
      if (s.insert > s.strstart) {
        s.insert = s.strstart;
      }
      slide_hash(s);
      more += _w_size;
    }
    if (s.strm.avail_in === 0) {
      break;
    }
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;
    if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];
      s.ins_h = HASH(s, s.ins_h, s.window[str + 1]);
      while (s.insert) {
        s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) {
          break;
        }
      }
    }
  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
};
var deflate_stored = (s, flush) => {
  let min_block = s.pending_buf_size - 5 > s.w_size ? s.w_size : s.pending_buf_size - 5;
  let len, left, have, last = 0;
  let used = s.strm.avail_in;
  do {
    len = 65535;
    have = s.bi_valid + 42 >> 3;
    if (s.strm.avail_out < have) {
      break;
    }
    have = s.strm.avail_out - have;
    left = s.strstart - s.block_start;
    if (len > left + s.strm.avail_in) {
      len = left + s.strm.avail_in;
    }
    if (len > have) {
      len = have;
    }
    if (len < min_block && (len === 0 && flush !== Z_FINISH$3 || flush === Z_NO_FLUSH$2 || len !== left + s.strm.avail_in)) {
      break;
    }
    last = flush === Z_FINISH$3 && len === left + s.strm.avail_in ? 1 : 0;
    _tr_stored_block(s, 0, 0, last);
    s.pending_buf[s.pending - 4] = len;
    s.pending_buf[s.pending - 3] = len >> 8;
    s.pending_buf[s.pending - 2] = ~len;
    s.pending_buf[s.pending - 1] = ~len >> 8;
    flush_pending(s.strm);
    if (left) {
      if (left > len) {
        left = len;
      }
      s.strm.output.set(s.window.subarray(s.block_start, s.block_start + left), s.strm.next_out);
      s.strm.next_out += left;
      s.strm.avail_out -= left;
      s.strm.total_out += left;
      s.block_start += left;
      len -= left;
    }
    if (len) {
      read_buf(s.strm, s.strm.output, s.strm.next_out, len);
      s.strm.next_out += len;
      s.strm.avail_out -= len;
      s.strm.total_out += len;
    }
  } while (last === 0);
  used -= s.strm.avail_in;
  if (used) {
    if (used >= s.w_size) {
      s.matches = 2;
      s.window.set(s.strm.input.subarray(s.strm.next_in - s.w_size, s.strm.next_in), 0);
      s.strstart = s.w_size;
      s.insert = s.strstart;
    } else {
      if (s.window_size - s.strstart <= used) {
        s.strstart -= s.w_size;
        s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
        if (s.matches < 2) {
          s.matches++;
        }
        if (s.insert > s.strstart) {
          s.insert = s.strstart;
        }
      }
      s.window.set(s.strm.input.subarray(s.strm.next_in - used, s.strm.next_in), s.strstart);
      s.strstart += used;
      s.insert += used > s.w_size - s.insert ? s.w_size - s.insert : used;
    }
    s.block_start = s.strstart;
  }
  if (s.high_water < s.strstart) {
    s.high_water = s.strstart;
  }
  if (last) {
    return BS_FINISH_DONE;
  }
  if (flush !== Z_NO_FLUSH$2 && flush !== Z_FINISH$3 && s.strm.avail_in === 0 && s.strstart === s.block_start) {
    return BS_BLOCK_DONE;
  }
  have = s.window_size - s.strstart;
  if (s.strm.avail_in > have && s.block_start >= s.w_size) {
    s.block_start -= s.w_size;
    s.strstart -= s.w_size;
    s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
    if (s.matches < 2) {
      s.matches++;
    }
    have += s.w_size;
    if (s.insert > s.strstart) {
      s.insert = s.strstart;
    }
  }
  if (have > s.strm.avail_in) {
    have = s.strm.avail_in;
  }
  if (have) {
    read_buf(s.strm, s.window, s.strstart, have);
    s.strstart += have;
    s.insert += have > s.w_size - s.insert ? s.w_size - s.insert : have;
  }
  if (s.high_water < s.strstart) {
    s.high_water = s.strstart;
  }
  have = s.bi_valid + 42 >> 3;
  have = s.pending_buf_size - have > 65535 ? 65535 : s.pending_buf_size - have;
  min_block = have > s.w_size ? s.w_size : have;
  left = s.strstart - s.block_start;
  if (left >= min_block || (left || flush === Z_FINISH$3) && flush !== Z_NO_FLUSH$2 && s.strm.avail_in === 0 && left <= have) {
    len = left > have ? have : left;
    last = flush === Z_FINISH$3 && s.strm.avail_in === 0 && len === left ? 1 : 0;
    _tr_stored_block(s, s.block_start, len, last);
    s.block_start += len;
    flush_pending(s.strm);
  }
  return last ? BS_FINISH_STARTED : BS_NEED_MORE;
};
var deflate_fast = (s, flush) => {
  let hash_head;
  let bflush;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) {
      s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
    }
    if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
        s.match_length--;
        do {
          s.strstart++;
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        } while (--s.match_length !== 0);
        s.strstart++;
      } else {
        s.strstart += s.match_length;
        s.match_length = 0;
        s.ins_h = s.window[s.strstart];
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1]);
      }
    } else {
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
var deflate_slow = (s, flush) => {
  let hash_head;
  let bflush;
  let max_insert;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) {
      s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
    }
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH - 1;
    if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
      if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) {
        s.match_length = MIN_MATCH - 1;
      }
    }
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do {
        if (++s.strstart <= max_insert) {
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        }
      } while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH - 1;
      s.strstart++;
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    } else if (s.match_available) {
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
      if (bflush) {
        flush_block_only(s, false);
      }
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  if (s.match_available) {
    bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
var deflate_rle = (s, flush) => {
  let bflush;
  let prev;
  let scan, strend;
  const _win = s.window;
  for (; ; ) {
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do {
        } while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead;
        }
      }
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
var deflate_huff = (s, flush) => {
  let bflush;
  for (; ; ) {
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        break;
      }
    }
    s.match_length = 0;
    bflush = _tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
function Config(good_length, max_lazy, nice_length, max_chain, func) {
  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
}
var configuration_table = [
  /*      good lazy nice chain */
  new Config(0, 0, 0, 0, deflate_stored),
  /* 0 store only */
  new Config(4, 4, 8, 4, deflate_fast),
  /* 1 max speed, no lazy matches */
  new Config(4, 5, 16, 8, deflate_fast),
  /* 2 */
  new Config(4, 6, 32, 32, deflate_fast),
  /* 3 */
  new Config(4, 4, 16, 16, deflate_slow),
  /* 4 lazy matches */
  new Config(8, 16, 32, 32, deflate_slow),
  /* 5 */
  new Config(8, 16, 128, 128, deflate_slow),
  /* 6 */
  new Config(8, 32, 128, 256, deflate_slow),
  /* 7 */
  new Config(32, 128, 258, 1024, deflate_slow),
  /* 8 */
  new Config(32, 258, 258, 4096, deflate_slow)
  /* 9 max compression */
];
var lm_init = (s) => {
  s.window_size = 2 * s.w_size;
  zero(s.head);
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;
  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
};
function DeflateState() {
  this.strm = null;
  this.status = 0;
  this.pending_buf = null;
  this.pending_buf_size = 0;
  this.pending_out = 0;
  this.pending = 0;
  this.wrap = 0;
  this.gzhead = null;
  this.gzindex = 0;
  this.method = Z_DEFLATED$2;
  this.last_flush = -1;
  this.w_size = 0;
  this.w_bits = 0;
  this.w_mask = 0;
  this.window = null;
  this.window_size = 0;
  this.prev = null;
  this.head = null;
  this.ins_h = 0;
  this.hash_size = 0;
  this.hash_bits = 0;
  this.hash_mask = 0;
  this.hash_shift = 0;
  this.block_start = 0;
  this.match_length = 0;
  this.prev_match = 0;
  this.match_available = 0;
  this.strstart = 0;
  this.match_start = 0;
  this.lookahead = 0;
  this.prev_length = 0;
  this.max_chain_length = 0;
  this.max_lazy_match = 0;
  this.level = 0;
  this.strategy = 0;
  this.good_match = 0;
  this.nice_match = 0;
  this.dyn_ltree = new Uint16Array(HEAP_SIZE * 2);
  this.dyn_dtree = new Uint16Array((2 * D_CODES + 1) * 2);
  this.bl_tree = new Uint16Array((2 * BL_CODES + 1) * 2);
  zero(this.dyn_ltree);
  zero(this.dyn_dtree);
  zero(this.bl_tree);
  this.l_desc = null;
  this.d_desc = null;
  this.bl_desc = null;
  this.bl_count = new Uint16Array(MAX_BITS + 1);
  this.heap = new Uint16Array(2 * L_CODES + 1);
  zero(this.heap);
  this.heap_len = 0;
  this.heap_max = 0;
  this.depth = new Uint16Array(2 * L_CODES + 1);
  zero(this.depth);
  this.sym_buf = 0;
  this.lit_bufsize = 0;
  this.sym_next = 0;
  this.sym_end = 0;
  this.opt_len = 0;
  this.static_len = 0;
  this.matches = 0;
  this.insert = 0;
  this.bi_buf = 0;
  this.bi_valid = 0;
}
var deflateStateCheck = (strm) => {
  if (!strm) {
    return 1;
  }
  const s = strm.state;
  if (!s || s.strm !== strm || s.status !== INIT_STATE && //#ifdef GZIP
  s.status !== GZIP_STATE && //#endif
  s.status !== EXTRA_STATE && s.status !== NAME_STATE && s.status !== COMMENT_STATE && s.status !== HCRC_STATE && s.status !== BUSY_STATE && s.status !== FINISH_STATE) {
    return 1;
  }
  return 0;
};
var deflateResetKeep = (strm) => {
  if (deflateStateCheck(strm)) {
    return err(strm, Z_STREAM_ERROR$2);
  }
  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN;
  const s = strm.state;
  s.pending = 0;
  s.pending_out = 0;
  if (s.wrap < 0) {
    s.wrap = -s.wrap;
  }
  s.status = //#ifdef GZIP
  s.wrap === 2 ? GZIP_STATE : (
    //#endif
    s.wrap ? INIT_STATE : BUSY_STATE
  );
  strm.adler = s.wrap === 2 ? 0 : 1;
  s.last_flush = -2;
  _tr_init(s);
  return Z_OK$3;
};
var deflateReset = (strm) => {
  const ret = deflateResetKeep(strm);
  if (ret === Z_OK$3) {
    lm_init(strm.state);
  }
  return ret;
};
var deflateSetHeader = (strm, head) => {
  if (deflateStateCheck(strm) || strm.state.wrap !== 2) {
    return Z_STREAM_ERROR$2;
  }
  strm.state.gzhead = head;
  return Z_OK$3;
};
var deflateInit2 = (strm, level, method, windowBits, memLevel, strategy) => {
  if (!strm) {
    return Z_STREAM_ERROR$2;
  }
  let wrap = 1;
  if (level === Z_DEFAULT_COMPRESSION$1) {
    level = 6;
  }
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else if (windowBits > 15) {
    wrap = 2;
    windowBits -= 16;
  }
  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED$2 || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED || windowBits === 8 && wrap !== 1) {
    return err(strm, Z_STREAM_ERROR$2);
  }
  if (windowBits === 8) {
    windowBits = 9;
  }
  const s = new DeflateState();
  strm.state = s;
  s.strm = strm;
  s.status = INIT_STATE;
  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;
  s.hash_bits = memLevel + 7;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
  s.window = new Uint8Array(s.w_size * 2);
  s.head = new Uint16Array(s.hash_size);
  s.prev = new Uint16Array(s.w_size);
  s.lit_bufsize = 1 << memLevel + 6;
  s.pending_buf_size = s.lit_bufsize * 4;
  s.pending_buf = new Uint8Array(s.pending_buf_size);
  s.sym_buf = s.lit_bufsize;
  s.sym_end = (s.lit_bufsize - 1) * 3;
  s.level = level;
  s.strategy = strategy;
  s.method = method;
  return deflateReset(strm);
};
var deflateInit = (strm, level) => {
  return deflateInit2(strm, level, Z_DEFLATED$2, MAX_WBITS$1, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY$1);
};
var deflate$2 = (strm, flush) => {
  if (deflateStateCheck(strm) || flush > Z_BLOCK$1 || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR$2) : Z_STREAM_ERROR$2;
  }
  const s = strm.state;
  if (!strm.output || strm.avail_in !== 0 && !strm.input || s.status === FINISH_STATE && flush !== Z_FINISH$3) {
    return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR$1 : Z_STREAM_ERROR$2);
  }
  const old_flush = s.last_flush;
  s.last_flush = flush;
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH$3) {
    return err(strm, Z_BUF_ERROR$1);
  }
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR$1);
  }
  if (s.status === INIT_STATE && s.wrap === 0) {
    s.status = BUSY_STATE;
  }
  if (s.status === INIT_STATE) {
    let header = Z_DEFLATED$2 + (s.w_bits - 8 << 4) << 8;
    let level_flags = -1;
    if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
      level_flags = 0;
    } else if (s.level < 6) {
      level_flags = 1;
    } else if (s.level === 6) {
      level_flags = 2;
    } else {
      level_flags = 3;
    }
    header |= level_flags << 6;
    if (s.strstart !== 0) {
      header |= PRESET_DICT;
    }
    header += 31 - header % 31;
    putShortMSB(s, header);
    if (s.strstart !== 0) {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 65535);
    }
    strm.adler = 1;
    s.status = BUSY_STATE;
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  }
  if (s.status === GZIP_STATE) {
    strm.adler = 0;
    put_byte(s, 31);
    put_byte(s, 139);
    put_byte(s, 8);
    if (!s.gzhead) {
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
      put_byte(s, OS_CODE);
      s.status = BUSY_STATE;
      flush_pending(strm);
      if (s.pending !== 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    } else {
      put_byte(
        s,
        (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16)
      );
      put_byte(s, s.gzhead.time & 255);
      put_byte(s, s.gzhead.time >> 8 & 255);
      put_byte(s, s.gzhead.time >> 16 & 255);
      put_byte(s, s.gzhead.time >> 24 & 255);
      put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
      put_byte(s, s.gzhead.os & 255);
      if (s.gzhead.extra && s.gzhead.extra.length) {
        put_byte(s, s.gzhead.extra.length & 255);
        put_byte(s, s.gzhead.extra.length >> 8 & 255);
      }
      if (s.gzhead.hcrc) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending, 0);
      }
      s.gzindex = 0;
      s.status = EXTRA_STATE;
    }
  }
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra) {
      let beg = s.pending;
      let left = (s.gzhead.extra.length & 65535) - s.gzindex;
      while (s.pending + left > s.pending_buf_size) {
        let copy = s.pending_buf_size - s.pending;
        s.pending_buf.set(s.gzhead.extra.subarray(s.gzindex, s.gzindex + copy), s.pending);
        s.pending = s.pending_buf_size;
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        s.gzindex += copy;
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
        beg = 0;
        left -= copy;
      }
      let gzhead_extra = new Uint8Array(s.gzhead.extra);
      s.pending_buf.set(gzhead_extra.subarray(s.gzindex, s.gzindex + left), s.pending);
      s.pending += left;
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      s.gzindex = 0;
    }
    s.status = NAME_STATE;
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name) {
      let beg = s.pending;
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
          beg = 0;
        }
        if (s.gzindex < s.gzhead.name.length) {
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      s.gzindex = 0;
    }
    s.status = COMMENT_STATE;
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment) {
      let beg = s.pending;
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
          beg = 0;
        }
        if (s.gzindex < s.gzhead.comment.length) {
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
    }
    s.status = HCRC_STATE;
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
      }
      put_byte(s, strm.adler & 255);
      put_byte(s, strm.adler >> 8 & 255);
      strm.adler = 0;
    }
    s.status = BUSY_STATE;
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  }
  if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== Z_NO_FLUSH$2 && s.status !== FINISH_STATE) {
    let bstate = s.level === 0 ? deflate_stored(s, flush) : s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1;
      }
      return Z_OK$3;
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        _tr_align(s);
      } else if (flush !== Z_BLOCK$1) {
        _tr_stored_block(s, 0, 0, false);
        if (flush === Z_FULL_FLUSH$1) {
          zero(s.head);
          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    }
  }
  if (flush !== Z_FINISH$3) {
    return Z_OK$3;
  }
  if (s.wrap <= 0) {
    return Z_STREAM_END$3;
  }
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 255);
    put_byte(s, strm.adler >> 8 & 255);
    put_byte(s, strm.adler >> 16 & 255);
    put_byte(s, strm.adler >> 24 & 255);
    put_byte(s, strm.total_in & 255);
    put_byte(s, strm.total_in >> 8 & 255);
    put_byte(s, strm.total_in >> 16 & 255);
    put_byte(s, strm.total_in >> 24 & 255);
  } else {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 65535);
  }
  flush_pending(strm);
  if (s.wrap > 0) {
    s.wrap = -s.wrap;
  }
  return s.pending !== 0 ? Z_OK$3 : Z_STREAM_END$3;
};
var deflateEnd = (strm) => {
  if (deflateStateCheck(strm)) {
    return Z_STREAM_ERROR$2;
  }
  const status = strm.state.status;
  strm.state = null;
  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$2) : Z_OK$3;
};
var deflateSetDictionary = (strm, dictionary) => {
  let dictLength = dictionary.length;
  if (deflateStateCheck(strm)) {
    return Z_STREAM_ERROR$2;
  }
  const s = strm.state;
  const wrap = s.wrap;
  if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) {
    return Z_STREAM_ERROR$2;
  }
  if (wrap === 1) {
    strm.adler = adler32_1(strm.adler, dictionary, dictLength, 0);
  }
  s.wrap = 0;
  if (dictLength >= s.w_size) {
    if (wrap === 0) {
      zero(s.head);
      s.strstart = 0;
      s.block_start = 0;
      s.insert = 0;
    }
    let tmpDict = new Uint8Array(s.w_size);
    tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0);
    dictionary = tmpDict;
    dictLength = s.w_size;
  }
  const avail = strm.avail_in;
  const next = strm.next_in;
  const input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s);
  while (s.lookahead >= MIN_MATCH) {
    let str = s.strstart;
    let n = s.lookahead - (MIN_MATCH - 1);
    do {
      s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
      s.prev[str & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = str;
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH - 1;
    fill_window(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return Z_OK$3;
};
var deflateInit_1 = deflateInit;
var deflateInit2_1 = deflateInit2;
var deflateReset_1 = deflateReset;
var deflateResetKeep_1 = deflateResetKeep;
var deflateSetHeader_1 = deflateSetHeader;
var deflate_2$1 = deflate$2;
var deflateEnd_1 = deflateEnd;
var deflateSetDictionary_1 = deflateSetDictionary;
var deflateInfo = "pako deflate (from Nodeca project)";
var deflate_1$2 = {
  deflateInit: deflateInit_1,
  deflateInit2: deflateInit2_1,
  deflateReset: deflateReset_1,
  deflateResetKeep: deflateResetKeep_1,
  deflateSetHeader: deflateSetHeader_1,
  deflate: deflate_2$1,
  deflateEnd: deflateEnd_1,
  deflateSetDictionary: deflateSetDictionary_1,
  deflateInfo
};
var _has = (obj, key) => {
  return Object.prototype.hasOwnProperty.call(obj, key);
};
var assign = function(obj) {
  const sources = Array.prototype.slice.call(arguments, 1);
  while (sources.length) {
    const source = sources.shift();
    if (!source) {
      continue;
    }
    if (typeof source !== "object") {
      throw new TypeError(source + "must be non-object");
    }
    for (const p in source) {
      if (_has(source, p)) {
        obj[p] = source[p];
      }
    }
  }
  return obj;
};
var flattenChunks = (chunks) => {
  let len = 0;
  for (let i = 0, l = chunks.length; i < l; i++) {
    len += chunks[i].length;
  }
  const result = new Uint8Array(len);
  for (let i = 0, pos = 0, l = chunks.length; i < l; i++) {
    let chunk = chunks[i];
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
};
var common = {
  assign,
  flattenChunks
};
var STR_APPLY_UIA_OK = true;
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch (__) {
  STR_APPLY_UIA_OK = false;
}
var _utf8len = new Uint8Array(256);
for (let q = 0; q < 256; q++) {
  _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
}
_utf8len[254] = _utf8len[254] = 1;
var string2buf = (str) => {
  if (typeof TextEncoder === "function" && TextEncoder.prototype.encode) {
    return new TextEncoder().encode(str);
  }
  let buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;
  for (m_pos = 0; m_pos < str_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 64512) === 56320) {
        c = 65536 + (c - 55296 << 10) + (c2 - 56320);
        m_pos++;
      }
    }
    buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
  }
  buf = new Uint8Array(buf_len);
  for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 64512) === 56320) {
        c = 65536 + (c - 55296 << 10) + (c2 - 56320);
        m_pos++;
      }
    }
    if (c < 128) {
      buf[i++] = c;
    } else if (c < 2048) {
      buf[i++] = 192 | c >>> 6;
      buf[i++] = 128 | c & 63;
    } else if (c < 65536) {
      buf[i++] = 224 | c >>> 12;
      buf[i++] = 128 | c >>> 6 & 63;
      buf[i++] = 128 | c & 63;
    } else {
      buf[i++] = 240 | c >>> 18;
      buf[i++] = 128 | c >>> 12 & 63;
      buf[i++] = 128 | c >>> 6 & 63;
      buf[i++] = 128 | c & 63;
    }
  }
  return buf;
};
var buf2binstring = (buf, len) => {
  if (len < 65534) {
    if (buf.subarray && STR_APPLY_UIA_OK) {
      return String.fromCharCode.apply(null, buf.length === len ? buf : buf.subarray(0, len));
    }
  }
  let result = "";
  for (let i = 0; i < len; i++) {
    result += String.fromCharCode(buf[i]);
  }
  return result;
};
var buf2string = (buf, max) => {
  const len = max || buf.length;
  if (typeof TextDecoder === "function" && TextDecoder.prototype.decode) {
    return new TextDecoder().decode(buf.subarray(0, max));
  }
  let i, out;
  const utf16buf = new Array(len * 2);
  for (out = 0, i = 0; i < len; ) {
    let c = buf[i++];
    if (c < 128) {
      utf16buf[out++] = c;
      continue;
    }
    let c_len = _utf8len[c];
    if (c_len > 4) {
      utf16buf[out++] = 65533;
      i += c_len - 1;
      continue;
    }
    c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
    while (c_len > 1 && i < len) {
      c = c << 6 | buf[i++] & 63;
      c_len--;
    }
    if (c_len > 1) {
      utf16buf[out++] = 65533;
      continue;
    }
    if (c < 65536) {
      utf16buf[out++] = c;
    } else {
      c -= 65536;
      utf16buf[out++] = 55296 | c >> 10 & 1023;
      utf16buf[out++] = 56320 | c & 1023;
    }
  }
  return buf2binstring(utf16buf, out);
};
var utf8border = (buf, max) => {
  max = max || buf.length;
  if (max > buf.length) {
    max = buf.length;
  }
  let pos = max - 1;
  while (pos >= 0 && (buf[pos] & 192) === 128) {
    pos--;
  }
  if (pos < 0) {
    return max;
  }
  if (pos === 0) {
    return max;
  }
  return pos + _utf8len[buf[pos]] > max ? pos : max;
};
var strings = {
  string2buf,
  buf2string,
  utf8border
};
function ZStream() {
  this.input = null;
  this.next_in = 0;
  this.avail_in = 0;
  this.total_in = 0;
  this.output = null;
  this.next_out = 0;
  this.avail_out = 0;
  this.total_out = 0;
  this.msg = "";
  this.state = null;
  this.data_type = 2;
  this.adler = 0;
}
var zstream = ZStream;
var toString$1 = Object.prototype.toString;
var {
  Z_NO_FLUSH: Z_NO_FLUSH$1,
  Z_SYNC_FLUSH,
  Z_FULL_FLUSH,
  Z_FINISH: Z_FINISH$2,
  Z_OK: Z_OK$2,
  Z_STREAM_END: Z_STREAM_END$2,
  Z_DEFAULT_COMPRESSION,
  Z_DEFAULT_STRATEGY,
  Z_DEFLATED: Z_DEFLATED$1
} = constants$2;
function Deflate$1(options) {
  this.options = common.assign({
    level: Z_DEFAULT_COMPRESSION,
    method: Z_DEFLATED$1,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: Z_DEFAULT_STRATEGY
  }, options || {});
  let opt = this.options;
  if (opt.raw && opt.windowBits > 0) {
    opt.windowBits = -opt.windowBits;
  } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
    opt.windowBits += 16;
  }
  this.err = 0;
  this.msg = "";
  this.ended = false;
  this.chunks = [];
  this.strm = new zstream();
  this.strm.avail_out = 0;
  let status = deflate_1$2.deflateInit2(
    this.strm,
    opt.level,
    opt.method,
    opt.windowBits,
    opt.memLevel,
    opt.strategy
  );
  if (status !== Z_OK$2) {
    throw new Error(messages[status]);
  }
  if (opt.header) {
    deflate_1$2.deflateSetHeader(this.strm, opt.header);
  }
  if (opt.dictionary) {
    let dict;
    if (typeof opt.dictionary === "string") {
      dict = strings.string2buf(opt.dictionary);
    } else if (toString$1.call(opt.dictionary) === "[object ArrayBuffer]") {
      dict = new Uint8Array(opt.dictionary);
    } else {
      dict = opt.dictionary;
    }
    status = deflate_1$2.deflateSetDictionary(this.strm, dict);
    if (status !== Z_OK$2) {
      throw new Error(messages[status]);
    }
    this._dict_set = true;
  }
}
Deflate$1.prototype.push = function(data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  let status, _flush_mode;
  if (this.ended) {
    return false;
  }
  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH$2 : Z_NO_FLUSH$1;
  if (typeof data === "string") {
    strm.input = strings.string2buf(data);
  } else if (toString$1.call(data) === "[object ArrayBuffer]") {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  for (; ; ) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    if ((_flush_mode === Z_SYNC_FLUSH || _flush_mode === Z_FULL_FLUSH) && strm.avail_out <= 6) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }
    status = deflate_1$2.deflate(strm, _flush_mode);
    if (status === Z_STREAM_END$2) {
      if (strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out));
      }
      status = deflate_1$2.deflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return status === Z_OK$2;
    }
    if (strm.avail_out === 0) {
      this.onData(strm.output);
      continue;
    }
    if (_flush_mode > 0 && strm.next_out > 0) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }
    if (strm.avail_in === 0) break;
  }
  return true;
};
Deflate$1.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};
Deflate$1.prototype.onEnd = function(status) {
  if (status === Z_OK$2) {
    this.result = common.flattenChunks(this.chunks);
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};
function deflate$1(input, options) {
  const deflator = new Deflate$1(options);
  deflator.push(input, true);
  if (deflator.err) {
    throw deflator.msg || messages[deflator.err];
  }
  return deflator.result;
}
function deflateRaw$1(input, options) {
  options = options || {};
  options.raw = true;
  return deflate$1(input, options);
}
function gzip$1(input, options) {
  options = options || {};
  options.gzip = true;
  return deflate$1(input, options);
}
var Deflate_1$1 = Deflate$1;
var deflate_2 = deflate$1;
var deflateRaw_1$1 = deflateRaw$1;
var gzip_1$1 = gzip$1;
var constants$1 = constants$2;
var deflate_1$1 = {
  Deflate: Deflate_1$1,
  deflate: deflate_2,
  deflateRaw: deflateRaw_1$1,
  gzip: gzip_1$1,
  constants: constants$1
};
var BAD$1 = 16209;
var TYPE$1 = 16191;
var inffast = function inflate_fast(strm, start) {
  let _in;
  let last;
  let _out;
  let beg;
  let end;
  let dmax;
  let wsize;
  let whave;
  let wnext;
  let s_window;
  let hold;
  let bits;
  let lcode;
  let dcode;
  let lmask;
  let dmask;
  let here;
  let op;
  let len;
  let dist;
  let from;
  let from_source;
  let input, output;
  const state = strm.state;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
  dmax = state.dmax;
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;
  top:
    do {
      if (bits < 15) {
        hold += input[_in++] << bits;
        bits += 8;
        hold += input[_in++] << bits;
        bits += 8;
      }
      here = lcode[hold & lmask];
      dolen:
        for (; ; ) {
          op = here >>> 24;
          hold >>>= op;
          bits -= op;
          op = here >>> 16 & 255;
          if (op === 0) {
            output[_out++] = here & 65535;
          } else if (op & 16) {
            len = here & 65535;
            op &= 15;
            if (op) {
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
              len += hold & (1 << op) - 1;
              hold >>>= op;
              bits -= op;
            }
            if (bits < 15) {
              hold += input[_in++] << bits;
              bits += 8;
              hold += input[_in++] << bits;
              bits += 8;
            }
            here = dcode[hold & dmask];
            dodist:
              for (; ; ) {
                op = here >>> 24;
                hold >>>= op;
                bits -= op;
                op = here >>> 16 & 255;
                if (op & 16) {
                  dist = here & 65535;
                  op &= 15;
                  if (bits < op) {
                    hold += input[_in++] << bits;
                    bits += 8;
                    if (bits < op) {
                      hold += input[_in++] << bits;
                      bits += 8;
                    }
                  }
                  dist += hold & (1 << op) - 1;
                  if (dist > dmax) {
                    strm.msg = "invalid distance too far back";
                    state.mode = BAD$1;
                    break top;
                  }
                  hold >>>= op;
                  bits -= op;
                  op = _out - beg;
                  if (dist > op) {
                    op = dist - op;
                    if (op > whave) {
                      if (state.sane) {
                        strm.msg = "invalid distance too far back";
                        state.mode = BAD$1;
                        break top;
                      }
                    }
                    from = 0;
                    from_source = s_window;
                    if (wnext === 0) {
                      from += wsize - op;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op);
                        from = _out - dist;
                        from_source = output;
                      }
                    } else if (wnext < op) {
                      from += wsize + wnext - op;
                      op -= wnext;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op);
                        from = 0;
                        if (wnext < len) {
                          op = wnext;
                          len -= op;
                          do {
                            output[_out++] = s_window[from++];
                          } while (--op);
                          from = _out - dist;
                          from_source = output;
                        }
                      }
                    } else {
                      from += wnext - op;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op);
                        from = _out - dist;
                        from_source = output;
                      }
                    }
                    while (len > 2) {
                      output[_out++] = from_source[from++];
                      output[_out++] = from_source[from++];
                      output[_out++] = from_source[from++];
                      len -= 3;
                    }
                    if (len) {
                      output[_out++] = from_source[from++];
                      if (len > 1) {
                        output[_out++] = from_source[from++];
                      }
                    }
                  } else {
                    from = _out - dist;
                    do {
                      output[_out++] = output[from++];
                      output[_out++] = output[from++];
                      output[_out++] = output[from++];
                      len -= 3;
                    } while (len > 2);
                    if (len) {
                      output[_out++] = output[from++];
                      if (len > 1) {
                        output[_out++] = output[from++];
                      }
                    }
                  }
                } else if ((op & 64) === 0) {
                  here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                  continue dodist;
                } else {
                  strm.msg = "invalid distance code";
                  state.mode = BAD$1;
                  break top;
                }
                break;
              }
          } else if ((op & 64) === 0) {
            here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
            continue dolen;
          } else if (op & 32) {
            state.mode = TYPE$1;
            break top;
          } else {
            strm.msg = "invalid literal/length code";
            state.mode = BAD$1;
            break top;
          }
          break;
        }
    } while (_in < last && _out < end);
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
  strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
  state.hold = hold;
  state.bits = bits;
  return;
};
var MAXBITS = 15;
var ENOUGH_LENS$1 = 852;
var ENOUGH_DISTS$1 = 592;
var CODES$1 = 0;
var LENS$1 = 1;
var DISTS$1 = 2;
var lbase = new Uint16Array([
  /* Length codes 257..285 base */
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  13,
  15,
  17,
  19,
  23,
  27,
  31,
  35,
  43,
  51,
  59,
  67,
  83,
  99,
  115,
  131,
  163,
  195,
  227,
  258,
  0,
  0
]);
var lext = new Uint8Array([
  /* Length codes 257..285 extra */
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  17,
  17,
  17,
  17,
  18,
  18,
  18,
  18,
  19,
  19,
  19,
  19,
  20,
  20,
  20,
  20,
  21,
  21,
  21,
  21,
  16,
  72,
  78
]);
var dbase = new Uint16Array([
  /* Distance codes 0..29 base */
  1,
  2,
  3,
  4,
  5,
  7,
  9,
  13,
  17,
  25,
  33,
  49,
  65,
  97,
  129,
  193,
  257,
  385,
  513,
  769,
  1025,
  1537,
  2049,
  3073,
  4097,
  6145,
  8193,
  12289,
  16385,
  24577,
  0,
  0
]);
var dext = new Uint8Array([
  /* Distance codes 0..29 extra */
  16,
  16,
  16,
  16,
  17,
  17,
  18,
  18,
  19,
  19,
  20,
  20,
  21,
  21,
  22,
  22,
  23,
  23,
  24,
  24,
  25,
  25,
  26,
  26,
  27,
  27,
  28,
  28,
  29,
  29,
  64,
  64
]);
var inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) => {
  const bits = opts.bits;
  let len = 0;
  let sym = 0;
  let min = 0, max = 0;
  let root = 0;
  let curr = 0;
  let drop = 0;
  let left = 0;
  let used = 0;
  let huff = 0;
  let incr;
  let fill;
  let low;
  let mask;
  let next;
  let base = null;
  let match;
  const count = new Uint16Array(MAXBITS + 1);
  const offs = new Uint16Array(MAXBITS + 1);
  let extra = null;
  let here_bits, here_op, here_val;
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }
  root = bits;
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) {
      break;
    }
  }
  if (root > max) {
    root = max;
  }
  if (max === 0) {
    table[table_index++] = 1 << 24 | 64 << 16 | 0;
    table[table_index++] = 1 << 24 | 64 << 16 | 0;
    opts.bits = 1;
    return 0;
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) {
      break;
    }
  }
  if (root < min) {
    root = min;
  }
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    }
  }
  if (left > 0 && (type === CODES$1 || max !== 1)) {
    return -1;
  }
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }
  if (type === CODES$1) {
    base = extra = work;
    match = 20;
  } else if (type === LENS$1) {
    base = lbase;
    extra = lext;
    match = 257;
  } else {
    base = dbase;
    extra = dext;
    match = 0;
  }
  huff = 0;
  sym = 0;
  len = min;
  next = table_index;
  curr = root;
  drop = 0;
  low = -1;
  used = 1 << root;
  mask = used - 1;
  if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
    return 1;
  }
  for (; ; ) {
    here_bits = len - drop;
    if (work[sym] + 1 < match) {
      here_op = 0;
      here_val = work[sym];
    } else if (work[sym] >= match) {
      here_op = extra[work[sym] - match];
      here_val = base[work[sym] - match];
    } else {
      here_op = 32 + 64;
      here_val = 0;
    }
    incr = 1 << len - drop;
    fill = 1 << curr;
    min = fill;
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
    } while (fill !== 0);
    incr = 1 << len - 1;
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }
    sym++;
    if (--count[len] === 0) {
      if (len === max) {
        break;
      }
      len = lens[lens_index + work[sym]];
    }
    if (len > root && (huff & mask) !== low) {
      if (drop === 0) {
        drop = root;
      }
      next += min;
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) {
          break;
        }
        curr++;
        left <<= 1;
      }
      used += 1 << curr;
      if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
        return 1;
      }
      low = huff & mask;
      table[low] = root << 24 | curr << 16 | next - table_index | 0;
    }
  }
  if (huff !== 0) {
    table[next + huff] = len - drop << 24 | 64 << 16 | 0;
  }
  opts.bits = root;
  return 0;
};
var inftrees = inflate_table;
var CODES = 0;
var LENS = 1;
var DISTS = 2;
var {
  Z_FINISH: Z_FINISH$1,
  Z_BLOCK,
  Z_TREES,
  Z_OK: Z_OK$1,
  Z_STREAM_END: Z_STREAM_END$1,
  Z_NEED_DICT: Z_NEED_DICT$1,
  Z_STREAM_ERROR: Z_STREAM_ERROR$1,
  Z_DATA_ERROR: Z_DATA_ERROR$1,
  Z_MEM_ERROR: Z_MEM_ERROR$1,
  Z_BUF_ERROR,
  Z_DEFLATED
} = constants$2;
var HEAD = 16180;
var FLAGS = 16181;
var TIME = 16182;
var OS = 16183;
var EXLEN = 16184;
var EXTRA = 16185;
var NAME = 16186;
var COMMENT = 16187;
var HCRC = 16188;
var DICTID = 16189;
var DICT = 16190;
var TYPE = 16191;
var TYPEDO = 16192;
var STORED = 16193;
var COPY_ = 16194;
var COPY = 16195;
var TABLE = 16196;
var LENLENS = 16197;
var CODELENS = 16198;
var LEN_ = 16199;
var LEN = 16200;
var LENEXT = 16201;
var DIST = 16202;
var DISTEXT = 16203;
var MATCH = 16204;
var LIT = 16205;
var CHECK = 16206;
var LENGTH = 16207;
var DONE = 16208;
var BAD = 16209;
var MEM = 16210;
var SYNC = 16211;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
var MAX_WBITS = 15;
var DEF_WBITS = MAX_WBITS;
var zswap32 = (q) => {
  return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
};
function InflateState() {
  this.strm = null;
  this.mode = 0;
  this.last = false;
  this.wrap = 0;
  this.havedict = false;
  this.flags = 0;
  this.dmax = 0;
  this.check = 0;
  this.total = 0;
  this.head = null;
  this.wbits = 0;
  this.wsize = 0;
  this.whave = 0;
  this.wnext = 0;
  this.window = null;
  this.hold = 0;
  this.bits = 0;
  this.length = 0;
  this.offset = 0;
  this.extra = 0;
  this.lencode = null;
  this.distcode = null;
  this.lenbits = 0;
  this.distbits = 0;
  this.ncode = 0;
  this.nlen = 0;
  this.ndist = 0;
  this.have = 0;
  this.next = null;
  this.lens = new Uint16Array(320);
  this.work = new Uint16Array(288);
  this.lendyn = null;
  this.distdyn = null;
  this.sane = 0;
  this.back = 0;
  this.was = 0;
}
var inflateStateCheck = (strm) => {
  if (!strm) {
    return 1;
  }
  const state = strm.state;
  if (!state || state.strm !== strm || state.mode < HEAD || state.mode > SYNC) {
    return 1;
  }
  return 0;
};
var inflateResetKeep = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = "";
  if (state.wrap) {
    strm.adler = state.wrap & 1;
  }
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.flags = -1;
  state.dmax = 32768;
  state.head = null;
  state.hold = 0;
  state.bits = 0;
  state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS);
  state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS);
  state.sane = 1;
  state.back = -1;
  return Z_OK$1;
};
var inflateReset = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);
};
var inflateReset2 = (strm, windowBits) => {
  let wrap;
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else {
    wrap = (windowBits >> 4) + 5;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR$1;
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null;
  }
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
};
var inflateInit2 = (strm, windowBits) => {
  if (!strm) {
    return Z_STREAM_ERROR$1;
  }
  const state = new InflateState();
  strm.state = state;
  state.strm = strm;
  state.window = null;
  state.mode = HEAD;
  const ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK$1) {
    strm.state = null;
  }
  return ret;
};
var inflateInit = (strm) => {
  return inflateInit2(strm, DEF_WBITS);
};
var virgin = true;
var lenfix;
var distfix;
var fixedtables = (state) => {
  if (virgin) {
    lenfix = new Int32Array(512);
    distfix = new Int32Array(32);
    let sym = 0;
    while (sym < 144) {
      state.lens[sym++] = 8;
    }
    while (sym < 256) {
      state.lens[sym++] = 9;
    }
    while (sym < 280) {
      state.lens[sym++] = 7;
    }
    while (sym < 288) {
      state.lens[sym++] = 8;
    }
    inftrees(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
    sym = 0;
    while (sym < 32) {
      state.lens[sym++] = 5;
    }
    inftrees(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
    virgin = false;
  }
  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
};
var updatewindow = (strm, src, end, copy) => {
  let dist;
  const state = strm.state;
  if (state.window === null) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;
    state.window = new Uint8Array(state.wsize);
  }
  if (copy >= state.wsize) {
    state.window.set(src.subarray(end - state.wsize, end), 0);
    state.wnext = 0;
    state.whave = state.wsize;
  } else {
    dist = state.wsize - state.wnext;
    if (dist > copy) {
      dist = copy;
    }
    state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext);
    copy -= dist;
    if (copy) {
      state.window.set(src.subarray(end - copy, end), 0);
      state.wnext = copy;
      state.whave = state.wsize;
    } else {
      state.wnext += dist;
      if (state.wnext === state.wsize) {
        state.wnext = 0;
      }
      if (state.whave < state.wsize) {
        state.whave += dist;
      }
    }
  }
  return 0;
};
var inflate$2 = (strm, flush) => {
  let state;
  let input, output;
  let next;
  let put;
  let have, left;
  let hold;
  let bits;
  let _in, _out;
  let copy;
  let from;
  let from_source;
  let here = 0;
  let here_bits, here_op, here_val;
  let last_bits, last_op, last_val;
  let len;
  let ret;
  const hbuf = new Uint8Array(4);
  let opts;
  let n;
  const order = (
    /* permutation of code lengths */
    new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15])
  );
  if (inflateStateCheck(strm) || !strm.output || !strm.input && strm.avail_in !== 0) {
    return Z_STREAM_ERROR$1;
  }
  state = strm.state;
  if (state.mode === TYPE) {
    state.mode = TYPEDO;
  }
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  _in = have;
  _out = left;
  ret = Z_OK$1;
  inf_leave:
    for (; ; ) {
      switch (state.mode) {
        case HEAD:
          if (state.wrap === 0) {
            state.mode = TYPEDO;
            break;
          }
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.wrap & 2 && hold === 35615) {
            if (state.wbits === 0) {
              state.wbits = 15;
            }
            state.check = 0;
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32_1(state.check, hbuf, 2, 0);
            hold = 0;
            bits = 0;
            state.mode = FLAGS;
            break;
          }
          if (state.head) {
            state.head.done = false;
          }
          if (!(state.wrap & 1) || /* check if zlib header allowed */
          (((hold & 255) << 8) + (hold >> 8)) % 31) {
            strm.msg = "incorrect header check";
            state.mode = BAD;
            break;
          }
          if ((hold & 15) !== Z_DEFLATED) {
            strm.msg = "unknown compression method";
            state.mode = BAD;
            break;
          }
          hold >>>= 4;
          bits -= 4;
          len = (hold & 15) + 8;
          if (state.wbits === 0) {
            state.wbits = len;
          }
          if (len > 15 || len > state.wbits) {
            strm.msg = "invalid window size";
            state.mode = BAD;
            break;
          }
          state.dmax = 1 << state.wbits;
          state.flags = 0;
          strm.adler = state.check = 1;
          state.mode = hold & 512 ? DICTID : TYPE;
          hold = 0;
          bits = 0;
          break;
        case FLAGS:
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.flags = hold;
          if ((state.flags & 255) !== Z_DEFLATED) {
            strm.msg = "unknown compression method";
            state.mode = BAD;
            break;
          }
          if (state.flags & 57344) {
            strm.msg = "unknown header flags set";
            state.mode = BAD;
            break;
          }
          if (state.head) {
            state.head.text = hold >> 8 & 1;
          }
          if (state.flags & 512 && state.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32_1(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = TIME;
        /* falls through */
        case TIME:
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head) {
            state.head.time = hold;
          }
          if (state.flags & 512 && state.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            hbuf[2] = hold >>> 16 & 255;
            hbuf[3] = hold >>> 24 & 255;
            state.check = crc32_1(state.check, hbuf, 4, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = OS;
        /* falls through */
        case OS:
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head) {
            state.head.xflags = hold & 255;
            state.head.os = hold >> 8;
          }
          if (state.flags & 512 && state.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32_1(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = EXLEN;
        /* falls through */
        case EXLEN:
          if (state.flags & 1024) {
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length = hold;
            if (state.head) {
              state.head.extra_len = hold;
            }
            if (state.flags & 512 && state.wrap & 4) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32_1(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
          } else if (state.head) {
            state.head.extra = null;
          }
          state.mode = EXTRA;
        /* falls through */
        case EXTRA:
          if (state.flags & 1024) {
            copy = state.length;
            if (copy > have) {
              copy = have;
            }
            if (copy) {
              if (state.head) {
                len = state.head.extra_len - state.length;
                if (!state.head.extra) {
                  state.head.extra = new Uint8Array(state.head.extra_len);
                }
                state.head.extra.set(
                  input.subarray(
                    next,
                    // extra field is limited to 65536 bytes
                    // - no need for additional size check
                    next + copy
                  ),
                  /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                  len
                );
              }
              if (state.flags & 512 && state.wrap & 4) {
                state.check = crc32_1(state.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              state.length -= copy;
            }
            if (state.length) {
              break inf_leave;
            }
          }
          state.length = 0;
          state.mode = NAME;
        /* falls through */
        case NAME:
          if (state.flags & 2048) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536) {
                state.head.name += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state.flags & 512 && state.wrap & 4) {
              state.check = crc32_1(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.name = null;
          }
          state.length = 0;
          state.mode = COMMENT;
        /* falls through */
        case COMMENT:
          if (state.flags & 4096) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536) {
                state.head.comment += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state.flags & 512 && state.wrap & 4) {
              state.check = crc32_1(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.comment = null;
          }
          state.mode = HCRC;
        /* falls through */
        case HCRC:
          if (state.flags & 512) {
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.wrap & 4 && hold !== (state.check & 65535)) {
              strm.msg = "header crc mismatch";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          if (state.head) {
            state.head.hcrc = state.flags >> 9 & 1;
            state.head.done = true;
          }
          strm.adler = state.check = 0;
          state.mode = TYPE;
          break;
        case DICTID:
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          strm.adler = state.check = zswap32(hold);
          hold = 0;
          bits = 0;
          state.mode = DICT;
        /* falls through */
        case DICT:
          if (state.havedict === 0) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            return Z_NEED_DICT$1;
          }
          strm.adler = state.check = 1;
          state.mode = TYPE;
        /* falls through */
        case TYPE:
          if (flush === Z_BLOCK || flush === Z_TREES) {
            break inf_leave;
          }
        /* falls through */
        case TYPEDO:
          if (state.last) {
            hold >>>= bits & 7;
            bits -= bits & 7;
            state.mode = CHECK;
            break;
          }
          while (bits < 3) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.last = hold & 1;
          hold >>>= 1;
          bits -= 1;
          switch (hold & 3) {
            case 0:
              state.mode = STORED;
              break;
            case 1:
              fixedtables(state);
              state.mode = LEN_;
              if (flush === Z_TREES) {
                hold >>>= 2;
                bits -= 2;
                break inf_leave;
              }
              break;
            case 2:
              state.mode = TABLE;
              break;
            case 3:
              strm.msg = "invalid block type";
              state.mode = BAD;
          }
          hold >>>= 2;
          bits -= 2;
          break;
        case STORED:
          hold >>>= bits & 7;
          bits -= bits & 7;
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
            strm.msg = "invalid stored block lengths";
            state.mode = BAD;
            break;
          }
          state.length = hold & 65535;
          hold = 0;
          bits = 0;
          state.mode = COPY_;
          if (flush === Z_TREES) {
            break inf_leave;
          }
        /* falls through */
        case COPY_:
          state.mode = COPY;
        /* falls through */
        case COPY:
          copy = state.length;
          if (copy) {
            if (copy > have) {
              copy = have;
            }
            if (copy > left) {
              copy = left;
            }
            if (copy === 0) {
              break inf_leave;
            }
            output.set(input.subarray(next, next + copy), put);
            have -= copy;
            next += copy;
            left -= copy;
            put += copy;
            state.length -= copy;
            break;
          }
          state.mode = TYPE;
          break;
        case TABLE:
          while (bits < 14) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.nlen = (hold & 31) + 257;
          hold >>>= 5;
          bits -= 5;
          state.ndist = (hold & 31) + 1;
          hold >>>= 5;
          bits -= 5;
          state.ncode = (hold & 15) + 4;
          hold >>>= 4;
          bits -= 4;
          if (state.nlen > 286 || state.ndist > 30) {
            strm.msg = "too many length or distance symbols";
            state.mode = BAD;
            break;
          }
          state.have = 0;
          state.mode = LENLENS;
        /* falls through */
        case LENLENS:
          while (state.have < state.ncode) {
            while (bits < 3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.lens[order[state.have++]] = hold & 7;
            hold >>>= 3;
            bits -= 3;
          }
          while (state.have < 19) {
            state.lens[order[state.have++]] = 0;
          }
          state.lencode = state.lendyn;
          state.lenbits = 7;
          opts = { bits: state.lenbits };
          ret = inftrees(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid code lengths set";
            state.mode = BAD;
            break;
          }
          state.have = 0;
          state.mode = CODELENS;
        /* falls through */
        case CODELENS:
          while (state.have < state.nlen + state.ndist) {
            for (; ; ) {
              here = state.lencode[hold & (1 << state.lenbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (here_val < 16) {
              hold >>>= here_bits;
              bits -= here_bits;
              state.lens[state.have++] = here_val;
            } else {
              if (here_val === 16) {
                n = here_bits + 2;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                if (state.have === 0) {
                  strm.msg = "invalid bit length repeat";
                  state.mode = BAD;
                  break;
                }
                len = state.lens[state.have - 1];
                copy = 3 + (hold & 3);
                hold >>>= 2;
                bits -= 2;
              } else if (here_val === 17) {
                n = here_bits + 3;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 3 + (hold & 7);
                hold >>>= 3;
                bits -= 3;
              } else {
                n = here_bits + 7;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 11 + (hold & 127);
                hold >>>= 7;
                bits -= 7;
              }
              if (state.have + copy > state.nlen + state.ndist) {
                strm.msg = "invalid bit length repeat";
                state.mode = BAD;
                break;
              }
              while (copy--) {
                state.lens[state.have++] = len;
              }
            }
          }
          if (state.mode === BAD) {
            break;
          }
          if (state.lens[256] === 0) {
            strm.msg = "invalid code -- missing end-of-block";
            state.mode = BAD;
            break;
          }
          state.lenbits = 9;
          opts = { bits: state.lenbits };
          ret = inftrees(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid literal/lengths set";
            state.mode = BAD;
            break;
          }
          state.distbits = 6;
          state.distcode = state.distdyn;
          opts = { bits: state.distbits };
          ret = inftrees(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
          state.distbits = opts.bits;
          if (ret) {
            strm.msg = "invalid distances set";
            state.mode = BAD;
            break;
          }
          state.mode = LEN_;
          if (flush === Z_TREES) {
            break inf_leave;
          }
        /* falls through */
        case LEN_:
          state.mode = LEN;
        /* falls through */
        case LEN:
          if (have >= 6 && left >= 258) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            inffast(strm, _out);
            put = strm.next_out;
            output = strm.output;
            left = strm.avail_out;
            next = strm.next_in;
            input = strm.input;
            have = strm.avail_in;
            hold = state.hold;
            bits = state.bits;
            if (state.mode === TYPE) {
              state.back = -1;
            }
            break;
          }
          state.back = 0;
          for (; ; ) {
            here = state.lencode[hold & (1 << state.lenbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (here_op && (here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          state.length = here_val;
          if (here_op === 0) {
            state.mode = LIT;
            break;
          }
          if (here_op & 32) {
            state.back = -1;
            state.mode = TYPE;
            break;
          }
          if (here_op & 64) {
            strm.msg = "invalid literal/length code";
            state.mode = BAD;
            break;
          }
          state.extra = here_op & 15;
          state.mode = LENEXT;
        /* falls through */
        case LENEXT:
          if (state.extra) {
            n = state.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          state.was = state.length;
          state.mode = DIST;
        /* falls through */
        case DIST:
          for (; ; ) {
            here = state.distcode[hold & (1 << state.distbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          if (here_op & 64) {
            strm.msg = "invalid distance code";
            state.mode = BAD;
            break;
          }
          state.offset = here_val;
          state.extra = here_op & 15;
          state.mode = DISTEXT;
        /* falls through */
        case DISTEXT:
          if (state.extra) {
            n = state.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.offset += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          if (state.offset > state.dmax) {
            strm.msg = "invalid distance too far back";
            state.mode = BAD;
            break;
          }
          state.mode = MATCH;
        /* falls through */
        case MATCH:
          if (left === 0) {
            break inf_leave;
          }
          copy = _out - left;
          if (state.offset > copy) {
            copy = state.offset - copy;
            if (copy > state.whave) {
              if (state.sane) {
                strm.msg = "invalid distance too far back";
                state.mode = BAD;
                break;
              }
            }
            if (copy > state.wnext) {
              copy -= state.wnext;
              from = state.wsize - copy;
            } else {
              from = state.wnext - copy;
            }
            if (copy > state.length) {
              copy = state.length;
            }
            from_source = state.window;
          } else {
            from_source = output;
            from = put - state.offset;
            copy = state.length;
          }
          if (copy > left) {
            copy = left;
          }
          left -= copy;
          state.length -= copy;
          do {
            output[put++] = from_source[from++];
          } while (--copy);
          if (state.length === 0) {
            state.mode = LEN;
          }
          break;
        case LIT:
          if (left === 0) {
            break inf_leave;
          }
          output[put++] = state.length;
          left--;
          state.mode = LEN;
          break;
        case CHECK:
          if (state.wrap) {
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold |= input[next++] << bits;
              bits += 8;
            }
            _out -= left;
            strm.total_out += _out;
            state.total += _out;
            if (state.wrap & 4 && _out) {
              strm.adler = state.check = /*UPDATE_CHECK(state.check, put - _out, _out);*/
              state.flags ? crc32_1(state.check, output, _out, put - _out) : adler32_1(state.check, output, _out, put - _out);
            }
            _out = left;
            if (state.wrap & 4 && (state.flags ? hold : zswap32(hold)) !== state.check) {
              strm.msg = "incorrect data check";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = LENGTH;
        /* falls through */
        case LENGTH:
          if (state.wrap && state.flags) {
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.wrap & 4 && hold !== (state.total & 4294967295)) {
              strm.msg = "incorrect length check";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = DONE;
        /* falls through */
        case DONE:
          ret = Z_STREAM_END$1;
          break inf_leave;
        case BAD:
          ret = Z_DATA_ERROR$1;
          break inf_leave;
        case MEM:
          return Z_MEM_ERROR$1;
        case SYNC:
        /* falls through */
        default:
          return Z_STREAM_ERROR$1;
      }
    }
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH$1)) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) ;
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap & 4 && _out) {
    strm.adler = state.check = /*UPDATE_CHECK(state.check, strm.next_out - _out, _out);*/
    state.flags ? crc32_1(state.check, output, _out, strm.next_out - _out) : adler32_1(state.check, output, _out, strm.next_out - _out);
  }
  strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if ((_in === 0 && _out === 0 || flush === Z_FINISH$1) && ret === Z_OK$1) {
    ret = Z_BUF_ERROR;
  }
  return ret;
};
var inflateEnd = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  let state = strm.state;
  if (state.window) {
    state.window = null;
  }
  strm.state = null;
  return Z_OK$1;
};
var inflateGetHeader = (strm, head) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  if ((state.wrap & 2) === 0) {
    return Z_STREAM_ERROR$1;
  }
  state.head = head;
  head.done = false;
  return Z_OK$1;
};
var inflateSetDictionary = (strm, dictionary) => {
  const dictLength = dictionary.length;
  let state;
  let dictid;
  let ret;
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  state = strm.state;
  if (state.wrap !== 0 && state.mode !== DICT) {
    return Z_STREAM_ERROR$1;
  }
  if (state.mode === DICT) {
    dictid = 1;
    dictid = adler32_1(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check) {
      return Z_DATA_ERROR$1;
    }
  }
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM;
    return Z_MEM_ERROR$1;
  }
  state.havedict = 1;
  return Z_OK$1;
};
var inflateReset_1 = inflateReset;
var inflateReset2_1 = inflateReset2;
var inflateResetKeep_1 = inflateResetKeep;
var inflateInit_1 = inflateInit;
var inflateInit2_1 = inflateInit2;
var inflate_2$1 = inflate$2;
var inflateEnd_1 = inflateEnd;
var inflateGetHeader_1 = inflateGetHeader;
var inflateSetDictionary_1 = inflateSetDictionary;
var inflateInfo = "pako inflate (from Nodeca project)";
var inflate_1$2 = {
  inflateReset: inflateReset_1,
  inflateReset2: inflateReset2_1,
  inflateResetKeep: inflateResetKeep_1,
  inflateInit: inflateInit_1,
  inflateInit2: inflateInit2_1,
  inflate: inflate_2$1,
  inflateEnd: inflateEnd_1,
  inflateGetHeader: inflateGetHeader_1,
  inflateSetDictionary: inflateSetDictionary_1,
  inflateInfo
};
function GZheader() {
  this.text = 0;
  this.time = 0;
  this.xflags = 0;
  this.os = 0;
  this.extra = null;
  this.extra_len = 0;
  this.name = "";
  this.comment = "";
  this.hcrc = 0;
  this.done = false;
}
var gzheader = GZheader;
var toString = Object.prototype.toString;
var {
  Z_NO_FLUSH,
  Z_FINISH,
  Z_OK,
  Z_STREAM_END,
  Z_NEED_DICT,
  Z_STREAM_ERROR,
  Z_DATA_ERROR,
  Z_MEM_ERROR
} = constants$2;
function Inflate$1(options) {
  this.options = common.assign({
    chunkSize: 1024 * 64,
    windowBits: 15,
    to: ""
  }, options || {});
  const opt = this.options;
  if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
    opt.windowBits = -opt.windowBits;
    if (opt.windowBits === 0) {
      opt.windowBits = -15;
    }
  }
  if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
    opt.windowBits += 32;
  }
  if (opt.windowBits > 15 && opt.windowBits < 48) {
    if ((opt.windowBits & 15) === 0) {
      opt.windowBits |= 15;
    }
  }
  this.err = 0;
  this.msg = "";
  this.ended = false;
  this.chunks = [];
  this.strm = new zstream();
  this.strm.avail_out = 0;
  let status = inflate_1$2.inflateInit2(
    this.strm,
    opt.windowBits
  );
  if (status !== Z_OK) {
    throw new Error(messages[status]);
  }
  this.header = new gzheader();
  inflate_1$2.inflateGetHeader(this.strm, this.header);
  if (opt.dictionary) {
    if (typeof opt.dictionary === "string") {
      opt.dictionary = strings.string2buf(opt.dictionary);
    } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
      opt.dictionary = new Uint8Array(opt.dictionary);
    }
    if (opt.raw) {
      status = inflate_1$2.inflateSetDictionary(this.strm, opt.dictionary);
      if (status !== Z_OK) {
        throw new Error(messages[status]);
      }
    }
  }
}
Inflate$1.prototype.push = function(data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  const dictionary = this.options.dictionary;
  let status, _flush_mode, last_avail_out;
  if (this.ended) return false;
  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH : Z_NO_FLUSH;
  if (toString.call(data) === "[object ArrayBuffer]") {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  for (; ; ) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    status = inflate_1$2.inflate(strm, _flush_mode);
    if (status === Z_NEED_DICT && dictionary) {
      status = inflate_1$2.inflateSetDictionary(strm, dictionary);
      if (status === Z_OK) {
        status = inflate_1$2.inflate(strm, _flush_mode);
      } else if (status === Z_DATA_ERROR) {
        status = Z_NEED_DICT;
      }
    }
    while (strm.avail_in > 0 && status === Z_STREAM_END && strm.state.wrap > 0 && data[strm.next_in] !== 0) {
      inflate_1$2.inflateReset(strm);
      status = inflate_1$2.inflate(strm, _flush_mode);
    }
    switch (status) {
      case Z_STREAM_ERROR:
      case Z_DATA_ERROR:
      case Z_NEED_DICT:
      case Z_MEM_ERROR:
        this.onEnd(status);
        this.ended = true;
        return false;
    }
    last_avail_out = strm.avail_out;
    if (strm.next_out) {
      if (strm.avail_out === 0 || status === Z_STREAM_END) {
        if (this.options.to === "string") {
          let next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
          let tail = strm.next_out - next_out_utf8;
          let utf8str = strings.buf2string(strm.output, next_out_utf8);
          strm.next_out = tail;
          strm.avail_out = chunkSize - tail;
          if (tail) strm.output.set(strm.output.subarray(next_out_utf8, next_out_utf8 + tail), 0);
          this.onData(utf8str);
        } else {
          this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out));
        }
      }
    }
    if (status === Z_OK && last_avail_out === 0) continue;
    if (status === Z_STREAM_END) {
      status = inflate_1$2.inflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return true;
    }
    if (strm.avail_in === 0) break;
  }
  return true;
};
Inflate$1.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};
Inflate$1.prototype.onEnd = function(status) {
  if (status === Z_OK) {
    if (this.options.to === "string") {
      this.result = this.chunks.join("");
    } else {
      this.result = common.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};
function inflate$1(input, options) {
  const inflator = new Inflate$1(options);
  inflator.push(input);
  if (inflator.err) throw inflator.msg || messages[inflator.err];
  return inflator.result;
}
function inflateRaw$1(input, options) {
  options = options || {};
  options.raw = true;
  return inflate$1(input, options);
}
var Inflate_1$1 = Inflate$1;
var inflate_2 = inflate$1;
var inflateRaw_1$1 = inflateRaw$1;
var ungzip$1 = inflate$1;
var constants = constants$2;
var inflate_1$1 = {
  Inflate: Inflate_1$1,
  inflate: inflate_2,
  inflateRaw: inflateRaw_1$1,
  ungzip: ungzip$1,
  constants
};
var { Deflate, deflate, deflateRaw, gzip } = deflate_1$1;
var { Inflate, inflate, inflateRaw, ungzip } = inflate_1$1;
var Deflate_1 = Deflate;
var deflate_1 = deflate;
var deflateRaw_1 = deflateRaw;
var gzip_1 = gzip;
var Inflate_1 = Inflate;
var inflate_1 = inflate;
var inflateRaw_1 = inflateRaw;
var ungzip_1 = ungzip;
var constants_1 = constants$2;
var pako = {
  Deflate: Deflate_1,
  deflate: deflate_1,
  deflateRaw: deflateRaw_1,
  gzip: gzip_1,
  Inflate: Inflate_1,
  inflate: inflate_1,
  inflateRaw: inflateRaw_1,
  ungzip: ungzip_1,
  constants: constants_1
};

// assets/js/encode.js
var MAPPING = [
  ..."abcdefghijklmnopqrstuvwxyz",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."0123456789",
  "(",
  ")"
];
function encodeForPrint(bytes) {
  let out = [], acc = 0, bits = 0;
  for (const b of bytes) {
    acc |= b << bits;
    bits += 8;
    while (bits >= 6) {
      out.push(MAPPING[acc & 63]);
      acc >>>= 6;
      bits -= 6;
    }
  }
  if (bits > 0) out.push(MAPPING[acc & 63]);
  return out.join("");
}
function compressRaw(dataStr) {
  const utf8 = new TextEncoder().encode(dataStr);
  return pako.deflateRaw(utf8, { level: 9 });
}
var TYPE_STRING = "^S";
var TYPE_NUMBER = "^N";
var TYPE_TRUE = "^B";
var TYPE_FALSE = "^b";
var TYPE_TABLE = "^T";
var TYPE_TABLE_END = "^t";
var ESCAPE_RULES = [
  [/[^\x00-\x7F]/g, "?"],
  [/\^/g, "}"],
  [/~/g, "~|"],
  [/\s/g, "~`"]
];
function escapeString(str) {
  for (const [pat, rep] of ESCAPE_RULES) {
    str = str.replace(pat, rep);
  }
  return str;
}
function serializeValue(val, out, config) {
  const t = typeof val;
  if (t === "string") {
    out.push(TYPE_STRING, escapeString(val));
  } else if (t === "number") {
    out.push(TYPE_NUMBER, String(val));
  } else if (t === "boolean") {
    out.push(val ? TYPE_TRUE : TYPE_FALSE);
  } else if (val == null) {
    return;
  } else if (t === "object") {
    out.push(TYPE_TABLE);
    const isArray = Array.isArray(val);
    if (isArray) {
      for (let i = 0; i < val.length; i++) {
        serializeValue(i + 1, out, config);
        serializeValue(val[i], out, config);
      }
    }
    const keys = Object.keys(val).filter((k) => !(isArray && /^\d+$/.test(k) && +k >= 1 && +k <= val.length)).sort((a, b) => {
      const na = /^\d+$/.test(a), nb = /^\d+$/.test(b);
      if (na && nb) return +a - +b;
      if (na) return -1;
      if (nb) return 1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    for (const k of keys) {
      const coercedKey = /^\d+$/.test(k) ? Number(k) : k;
      serializeValue(coercedKey, out, config);
      serializeValue(val[k], out, config);
    }
    out.push(TYPE_TABLE_END);
  } else {
    if (config.errorOnUnserializableType) {
      throw new Error(`Cannot serialize type ${t}`);
    }
  }
}
function serializeEx(inTable, config) {
  config = config || { errorOnUnserializableType: true };
  const out = ["^1"];
  serializeValue(inTable, out, config);
  out.push("^^");
  return out.join("");
}
function fixNumericIndexes(tbl) {
  const fixed = {};
  for (const [k, v] of Object.entries(tbl)) {
    const n = Number(k);
    if (!isNaN(n) && n > 0) fixed[n] = v;
    else fixed[k] = v;
  }
  return fixed;
}
function fixWATables(obj) {
  if (obj.triggers) {
    obj.triggers = fixNumericIndexes(obj.triggers);
    for (const t of Object.values(obj.triggers)) {
      const trg = t.trigger;
      if (trg?.form?.multi) trg.form.multi = fixNumericIndexes(trg.form.multi);
      if (trg?.talent?.multi) trg.talent.multi = fixNumericIndexes(trg.talent.multi);
      if (trg?.specId?.multi) trg.specId.multi = fixNumericIndexes(trg.specId.multi);
      if (trg?.herotalent?.multi) trg.herotalent.multi = fixNumericIndexes(trg.herotalent.multi);
      if (trg?.actualSpec) trg.actualSpec = fixNumericIndexes(trg.actualSpec);
      if (trg?.arena_spec) trg.arena_spec = fixNumericIndexes(trg.arena_spec);
    }
  }
  if (obj.load) {
    for (const key of ["talent", "talent2", "talent3", "herotalent", "class_and_spec"]) {
      if (obj.load[key]?.multi) {
        obj.load[key].multi = fixNumericIndexes(obj.load[key].multi);
      }
    }
  }
  return obj;
}
function encode(full, forChat = true) {
  if (!full || typeof full !== "object" || !full.d) {
    throw new Error("Invalid WA JSON");
  }
  const t = JSON.parse(JSON.stringify(full));
  t.d = fixWATables(t.d);
  if (Array.isArray(t.c)) {
    t.c = t.c.map((c) => c ? fixWATables(c) : c);
  }
  const serialized = serializeEx(t);
  const deflated = compressRaw(serialized);
  const body = encodeForPrint(deflated);
  return `!WA:1!${body}`;
}

// templates/ExportData.json
var ExportData_default = {
  d: {},
  c: {},
  m: "d",
  s: "WACreator",
  v: 1421
};

// templates/aura_types/DynamicGroup.json
var DynamicGroup_default = {
  grow: "RIGHT",
  sortHybridTable: {},
  borderBackdrop: "Blizzard Tooltip",
  xOffset: 0,
  yOffset: 0,
  anchorPoint: "CENTER",
  borderColor: {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 1
  },
  columnSpace: 1,
  radius: 200,
  selfPoint: "CENTER",
  align: "CENTER",
  centerType: "LR",
  backdropColor: {
    "1": 1,
    "2": 1,
    "3": 1,
    "4": 0.5
  },
  useLimit: true,
  animate: false,
  arcLength: 360,
  scale: 1,
  border: false,
  borderEdge: "Square Full White",
  regionType: "dynamicgroup",
  borderSize: 2,
  sort: "none",
  rotation: 0,
  fullCircle: true,
  constantFactor: "RADIUS",
  limit: 7,
  borderOffset: 4,
  gridType: "RD",
  borderInset: 1,
  id: "WACREATOR TEMPLATE GROUP",
  gridWidth: 5,
  frameStrata: 1,
  anchorFrameType: "SCREEN",
  rowSpace: 1,
  config: {},
  authorOptions: {},
  conditions: {},
  information: {},
  internalVersion: 59,
  actions: {
    finish: {},
    init: {},
    start: {}
  },
  animation: {
    finish: {
      duration_type: "seconds",
      easeStrength: 3,
      easeType: "none",
      type: "none"
    },
    main: {
      duration_type: "seconds",
      easeStrength: 3,
      easeType: "none",
      type: "none"
    },
    start: {
      duration_type: "seconds",
      easeStrength: 3,
      easeType: "none",
      type: "none"
    }
  },
  load: {
    class: {
      multi: {}
    },
    size: {
      multi: {}
    },
    spec: {
      multi: {}
    },
    talent: {
      multi: {}
    }
  },
  space: 2,
  stagger: 0,
  triggers: {
    "1": {
      trigger: {
        debuffType: "HELPFUL",
        event: "Health",
        names: {},
        spellIds: {},
        subeventPrefix: "SPELL",
        subeventSuffix: "_CAST_START",
        type: "aura2",
        unit: "player"
      },
      untrigger: {}
    }
  },
  url: "https://wago.io/TESTINGDONOTUSEGROUP",
  uid: "WOOOHOOO",
  desc: "This Group was auto generated by https://weakaurascreator.github.io"
};

// templates/aura_types/emptyRegion.json
var emptyRegion_default = {
  authorOptions: {},
  yOffset: 0,
  regionType: "empty",
  xOffset: 0,
  actions: {
    start: {},
    init: {},
    finish: {}
  },
  triggers: {},
  anchorFrameType: "SCREEN",
  internalVersion: 84,
  alpha: 1,
  animation: {
    start: {
      type: "none",
      easeStrength: 3,
      duration_type: "seconds",
      easeType: "none"
    },
    main: {
      type: "none",
      easeStrength: 3,
      duration_type: "seconds",
      easeType: "none"
    },
    finish: {
      type: "none",
      easeStrength: 3,
      duration_type: "seconds",
      easeType: "none"
    }
  },
  id: "EMPTY REGION TEMPLATE",
  config: {},
  frameStrata: 1,
  width: 200,
  anchorPoint: "CENTER",
  uid: "EMPTY REGION TEMPLATE",
  selfPoint: "CENTER",
  subRegions: {},
  height: 200,
  conditions: {},
  information: {},
  load: {
    size: {
      multi: {}
    },
    spec: {
      multi: {}
    },
    class: {
      multi: {}
    },
    talent: {
      multi: {}
    }
  }
};

// data/metadata.json
var metadata_default = {
  environment: "live",
  wowBuild: "11.2.5.64270",
  contentHash: "26c4b2cc70e84c013e4aae4e0216dd02",
  generatedAt: "2025-11-07T19:31:55.214Z",
  files: [
    "atlas-members.json",
    "augments.json",
    "bonus-affix-names.json",
    "bonus-corruption.json",
    "bonus-crafted-stats.json",
    "bonus-effects.json",
    "bonus-id-base-levels.json",
    "bonus-id-levels.json",
    "bonus-level-deltas.json",
    "bonus-sockets.json",
    "bonus-upgrade-sets.json",
    "bonuses.json",
    "class-traits.json",
    "crafting.json",
    "enchantments-all.json",
    "enchantments.json",
    "encounter-items.json",
    "encounter-names.json",
    "equippable-items-full.json",
    "equippable-items.json",
    "export-items-catalyst.json",
    "flasks.json",
    "foods.json",
    "gems.json",
    "icon-lookup.json",
    "icon-paths.txt",
    "instance-names.json",
    "instances.json",
    "item-conversions.json",
    "item-curves.json",
    "item-limit-categories.json",
    "item-names.json",
    "item-sets.json",
    "journal-paths.txt",
    "legendary-abilities.json",
    "level-selector-sequences.json",
    "manifest-paths-all.txt",
    "manifest-paths.txt",
    "potions.json",
    "seasons.json",
    "simc-addon.lua",
    "spell-scaling-table.json",
    "talents.json",
    "temp-enchants.json"
  ]
};

// templates/triggers/encounter.json
var encounter_default = {
  trigger: {
    debuffType: "HELPFUL",
    delay: 5,
    duration: "",
    event: "Encounter Events",
    eventtype: "ENCOUNTER_START",
    names: {},
    spellIds: {},
    subeventPrefix: "SPELL",
    subeventSuffix: "_CAST_START",
    type: "event",
    unit: "player",
    use_delay: true,
    use_eventtype: true
  },
  untrigger: {}
};

// templates/triggers/cast.json
var cast_default = {
  trigger: {
    type: "unit",
    event: "Cast",
    unit: "nameplate",
    use_spellId: false,
    spellId: null,
    use_unit: true,
    subeventSuffix: "_CAST_START",
    spellIds: {},
    names: {},
    subeventPrefix: "SPELL",
    debuffType: "HELPFUL"
  },
  untrigger: {}
};

// templates/triggers/buff.json
var buff_default = {
  trigger: {
    type: "aura2",
    subeventSuffix: "_CAST_START",
    event: "Health",
    unit: "player",
    spellIds: {},
    names: {},
    subeventPrefix: "SPELL",
    useName: true,
    auranames: {},
    debuffType: "HARMFUL",
    useMatch_count: true,
    match_countOperator: ">",
    match_count: "0",
    ignoreSelf: true,
    showClones: false
  },
  untrigger: {}
};

// templates/triggers/unit_characteristics.json
var unit_characteristics_default = {
  trigger: {
    use_specId: false,
    type: "unit",
    use_absorbHealMode: true,
    use_absorbMode: true,
    event: "Unit Characteristics",
    unit: "group",
    use_class: false,
    specId: {
      single: 63,
      multi: {}
    },
    use_spec: true,
    use_character: false,
    use_unit: true,
    debuffType: "HELPFUL",
    use_ignoreSelf: true
  },
  untrigger: {}
};

// templates/triggers/health.json
var health_default = {
  trigger: {
    use_specId: false,
    type: "unit",
    use_absorbHealMode: true,
    class: "DRUID",
    event: "Health",
    use_unit: true,
    use_class: false,
    specId: {
      multi: {
        "63": true
      }
    },
    use_absorbMode: true,
    unit: "group",
    debuffType: "HELPFUL"
  },
  untrigger: {}
};

// templates/triggers/cooldown.json
var cooldown_default = {
  trigger: {
    type: "spell",
    use_genericShowOn: true,
    event: "Cooldown Progress (Spell)",
    unit: "player",
    use_spellName: true,
    debuffType: "HELPFUL",
    genericShowOn: "showOnReady",
    use_track: true,
    spellName: 10060
  },
  untrigger: {}
};

// templates/triggers/event.json
var event_default = {
  trigger: {
    type: "custom",
    subeventSuffix: "_CAST_START",
    event: "Health",
    unit: "player",
    spellIds: {},
    names: {},
    subeventPrefix: "SPELL",
    useName: true,
    auranames: {},
    debuffType: "HARMFUL",
    useMatch_count: true,
    match_countOperator: ">",
    match_count: "0",
    ignoreSelf: true,
    custom: "",
    duration: "0",
    events: "",
    custom_hide: "timed",
    custom_type: "event"
  },
  untrigger: {}
};

// templates/data/debuffType.json
var debuffType_default = {
  buff: "HELPFUL",
  debuff: "HARMFUL"
};

// templates/data/units.json
var units_default = {
  Group: "group",
  Player: "player"
};

// assets/js/weakauras-core.js
var Triggers = {};
var Data = {};
Triggers.encounter = encounter_default;
Triggers.cast = cast_default;
Triggers.buff = buff_default;
Triggers.unit_characteristics = unit_characteristics_default;
Triggers.health = health_default;
Triggers.cooldown = cooldown_default;
Triggers.event = event_default;
Data.debuffType = debuffType_default;
Data.units = units_default;
function addAuraToGroup(group, aura) {
  aura.parent = group.d.uid;
  aura.preferToUpdate = true;
  aura.wagoID = group.d.wagoID;
  aura.version = group.d.version;
  aura.source = group.d.source;
  aura.tocversion = group.d.tocversion;
  aura.semver = group.d.semver;
  aura.internalVersion = group.d.internalVersion;
  aura.url = group.d.url;
  addAura(group, aura);
}
function addTrigger(aura, trigger) {
  const existingKeys = Object.keys(aura.triggers).map((k) => parseInt(k, 10)).filter((n) => !isNaN(n));
  const newIndex = existingKeys.length ? Math.max(...existingKeys) + 1 : 1;
  aura.triggers[newIndex.toString()] = trigger;
  aura.triggers.activeTriggerMode = -10;
}
function setTriggerUnit(trigger, unit) {
  if (Data.units[unit]) {
    trigger.trigger.unit = Data.units[unit];
  } else {
    console.error(`Unit "${unit}" not found in Data.units`);
  }
  return trigger;
}
function setAuthorOptions(aura, authorOptions) {
  if (authorOptions) {
    aura.authorOptions = authorOptions;
  } else {
    console.error(`Author options for aura "${aura}" can't be nil`);
  }
  return aura;
}
function setCustomTrigger(trigger, custom, events, duration) {
  if (trigger.trigger.type !== "custom") {
    console.error(
      `Custom trigger could not be set for trigger "${trigger}" type "${trigger.trigger.type}" not supported`
    );
  }
  trigger.trigger.custom = custom;
  if (duration) {
    trigger.trigger.custom_hide = "timed";
    trigger.trigger.duration = String(duration);
  }
  if (events) {
    trigger.trigger.events = events;
  }
  return trigger;
}
function setAuraId(aura, idString) {
  if (idString) {
    aura.id = idString;
  } else {
    console.error(`ID for aura "${aura}" can't be nil`);
  }
  return aura;
}
function setAuraUid(aura, idString) {
  if (idString) {
    aura.uid = idString;
  } else {
    console.error(`UID for aura "${aura}" can't be nil`);
  }
  return aura;
}
function setAuraWidth(aura, width) {
  aura.width = Number(width);
}
function setAuraHeight(aura, height) {
  aura.height = Number(height);
}
function setSpellIds(trigger, spellIds, useExactSpellId = false) {
  if (trigger.trigger.type === "aura2") {
    if (useExactSpellId) {
      trigger.trigger.auraspellids = spellIds;
      trigger.trigger.useExactSpellId = true;
      trigger.trigger.useName = false;
    } else {
      trigger.trigger.auranames = spellIds;
      trigger.trigger.useName = true;
    }
  } else {
    console.error(
      `SpellIds could not be set for trigger "${trigger}" type "${trigger.trigger.type}" not supported`
    );
  }
  return trigger;
}
function setTriggerIncludesPets(trigger, includePets) {
  trigger.trigger.use_includePets = includePets;
  trigger.trigger.includePets = "PlayersAndPets";
}
function setAnchorPerFrame(aura, anchorFrame) {
  aura.anchorPerUnit = anchorFrame;
  aura.useAnchorPerUnit = true;
}
function setLoadInBossfight(aura, inBossfight) {
  if (inBossfight === void 0) return;
  aura.load.use_encounter = inBossfight;
}
function addSpecId(trigger, specId) {
  if (trigger.trigger.type === "unit" && trigger.trigger.event === "Unit Characteristics") {
    trigger.trigger.specId.multi[specId] = true;
  } else if (trigger.trigger.type === "aura2") {
    trigger.trigger.actualSpec = trigger.trigger.actualSpec || {};
    trigger.trigger.actualSpec[specId] = true;
    trigger.trigger.useActualSpec = true;
  } else {
    console.error(
      `SpecId could not be set for trigger "${trigger}" type "${trigger.trigger.type}" not supported`
    );
  }
  return trigger;
}
function setDeBuffType(trigger, type) {
  if (Data.debuffType[type]) {
    trigger.trigger.debuffType = Data.debuffType[type];
  } else {
    console.error(`Type "${type}" not found in Data.debuffType`);
  }
  return trigger;
}
function setTriggerMode(aura, mode, customTriggerLogic) {
  aura.triggers.disjunctive = mode;
  if (mode === "custom") {
    aura.triggers.customTriggerLogic = customTriggerLogic;
  }
  aura.triggers.activeTriggerMode = -10;
  return aura;
}
function setActionsOnShowCustom(aura, custom) {
  aura.actions.start.do_custom = true;
  aura.actions.start.custom = custom;
  return aura;
}
function setActionsOnInitCustom(aura, custom) {
  aura.actions.init.do_custom = true;
  aura.actions.init.custom = custom;
  return aura;
}
function addAura(group, aura) {
  const existingKeys = Object.keys(group.c).map((k) => parseInt(k, 10)).filter((n) => !isNaN(n));
  const newIndex = existingKeys.length ? Math.max(...existingKeys) + 1 : 1;
  group.c[newIndex] = aura;
  group.d.sortHybridTable[aura.id] = false;
}
function createGroupToExport(name) {
  let ExportTable = JSON.parse(JSON.stringify(ExportData_default));
  ExportTable.d = JSON.parse(JSON.stringify(DynamicGroup_default));
  let id = "WACreator_" + name;
  ExportTable.d.id = id;
  let uid = id + "UID";
  ExportTable.d.uid = uid;
  let wagoID = uid;
  ExportTable.d.wagoID = wagoID;
  let version = 0;
  let semver = "1.0." + version;
  ExportTable.d.version = version;
  ExportTable.d.semver = semver;
  ExportTable.d.url = "https://wago.io/" + name + "/" + version;
  let tocversion = getTocVersion(metadata_default);
  ExportTable.d.tocversion = tocversion;
  let source = "import";
  ExportTable.d.source = source;
  let internalVersion = 66;
  ExportTable.d.internalVersion = internalVersion;
  ExportTable.d.limit = 100;
  ExportTable.d.grow = "DOWN";
  ExportTable.d.align = "CENTER";
  ExportTable.d.stagger = 0;
  ExportTable.d.space = 0;
  let xOffset = 0;
  let yOffset = 0;
  ExportTable.d.xOffset = xOffset;
  ExportTable.d.yOffset = yOffset;
  return ExportTable;
}
function getTocVersion(MetaData) {
  const buildStr = MetaData.wowBuild;
  const parts = buildStr.split(".");
  const [major, minor, patch] = parts;
  const tocversion = parseInt(major, 10) * 1e4 + parseInt(minor, 10) * 100 + parseInt(patch, 10);
  return tocversion;
}

// templates/aura_types/piAura.json
var piAura_default = {
  iconSource: -1,
  color: {
    "1": 1,
    "2": 1,
    "3": 1,
    "4": 1
  },
  adjustedMax: "",
  adjustedMin: "",
  yOffset: 0,
  anchorPoint: "CENTER",
  cooldownSwipe: true,
  cooldownEdge: false,
  icon: true,
  triggers: {},
  internalVersion: 84,
  progressSource: {
    "1": -1,
    "2": ""
  },
  selfPoint: "CENTER",
  desaturate: false,
  subRegions: {
    "1": {
      type: "subbackground"
    },
    "2": {
      text_shadowXOffset: 0,
      text_text_format_s_format: "none",
      text_text: "%s",
      text_shadowColor: {
        "1": "0",
        "2": "0",
        "3": "0",
        "4": "1"
      },
      text_selfPoint: "AUTO",
      text_automaticWidth: "Auto",
      text_fixedWidth: 64,
      anchorYOffset: 0,
      text_justify: "CENTER",
      rotateText: "NONE",
      type: "subtext",
      text_color: {
        "1": "1",
        "2": "1",
        "3": "1",
        "4": "1"
      },
      text_font: "Friz Quadrata TT",
      text_shadowYOffset: 0,
      text_wordWrap: "WordWrap",
      text_visible: true,
      anchor_point: "INNER_BOTTOMRIGHT",
      text_fontSize: 12,
      anchorXOffset: 0,
      text_fontType: "OUTLINE"
    },
    "3": {
      glowFrequency: 0.25,
      type: "subglow",
      useGlowColor: false,
      glowType: "buttonOverlay",
      glowLength: 10,
      glowYOffset: 0,
      glowColor: {
        "1": "1",
        "2": "1",
        "3": "1",
        "4": "1"
      },
      glowDuration: 1,
      glowXOffset: 0,
      glowThickness: 1,
      glowScale: 1,
      glow: false,
      glowLines: 8,
      glowBorder: false
    }
  },
  height: 64,
  load: {
    ingroup: {
      single: "group",
      multi: {
        group: true
      }
    },
    talent: {
      multi: {}
    },
    class: {
      multi: {}
    },
    spec: {
      multi: {}
    },
    size: {
      multi: {}
    }
  },
  useAdjustededMax: false,
  useAdjustededMin: false,
  regionType: "icon",
  actions: {
    start: {
      do_glow: true,
      glow_type: "Pixel",
      glow_frame_type: "UNITFRAME",
      glow_action: "show"
    },
    finish: {
      do_glow: false,
      hide_all_glows: true,
      glow_frame_type: "UNITFRAME",
      glow_action: "show"
    },
    init: {}
  },
  information: {},
  animation: {
    start: {
      easeStrength: 3,
      type: "none",
      duration_type: "seconds",
      easeType: "none"
    },
    main: {
      easeStrength: 3,
      type: "none",
      duration_type: "seconds",
      easeType: "none"
    },
    finish: {
      easeStrength: 3,
      type: "none",
      duration_type: "seconds",
      easeType: "none"
    }
  },
  parent: "Cooldowns active (pi)",
  authorOptions: {},
  zoom: 0,
  cooldownTextDisabled: false,
  uid: "WFq)kR7ppQu",
  useCooldownModRate: true,
  id: "Pi-Aura-Template",
  anchorFrameType: "SCREEN",
  alpha: 1,
  width: 64,
  frameStrata: 1,
  config: {},
  inverse: false,
  keepAspectRatio: false,
  conditions: {},
  cooldown: true,
  xOffset: 0
};

// templates/aura_types/piChatAura.json
var piChatAura_default = {
  actions: {
    start: {
      custom: 'local channel = IsInGroup(LE_PARTY_CATEGORY_INSTANCE) and "INSTANCE_CHAT" or IsInRaid() and "RAID" or "PARTY"\n\nif aura_env.dpsList and #aura_env.dpsList ~= 0 then \n\nif aura_env.config.targetCount == 1 then\n    SendChatMessage("Best Pi Target for Singletarget: ",channel)\nelse\n    SendChatMessage("Best Pi Target for "..aura_env.configToCount[aura_env.config.targetCount].." targets: ",channel)\nend\n\n\nfor _,dpsgain in pairs (aura_env.dpsList) do\n    SendChatMessage(dpsgain.name.." : ".. dpsgain.gain, channel)\nend\n\nif not aura_env.config.disableTargetCountReminder then\n    SendChatMessage("Other target Counts are available (1,3,5,8,15). Adjust them via custom options")\nend\n\nif not aura_env.config.disableLastUpdated then\n    SendChatMessage("Brought to you by WACreator. Last updated: "..aura_env.updated,channel)\n    \nend\nelse\n SendChatMessage("No dps currently in group",channel)\n end\n\n'
    },
    init: {
      custom: "\n\naura_env.sortFunct = function(a,b)\n    return a.gain>b.gain\nend\n\naura_env.sortPiValues = function(t)\n    return table.sort(t,aura_env.sortFunct)\nend\n aura_env.configToCount = {[1] = 1, [2] = 3, [3]=5, [4]=8, [5]=15}"
    }
  },
  triggers: [
    {
      trigger: {
        type: "custom",
        custom_trigger: 'function(event, text, _, _, channelName, _, _, _, channelIndex, channelBaseName)\n    if text then\n        local beginning,ending = string.find(text, "!pi" ,1)\n        if  beginning and  beginning == 1 then\n            local dpsList = {}\n            for unit in WA_IterateGroupMembers() do\n                local specID = WeakAuras.SpecForUnit(unit)\n                local name =  UnitName(unit)\n                local guid = UnitGUID(unit)\n                if aura_env.piList[aura_env.configToCount[aura_env.config.targetCount]][specID] then \n table.insert(dpsList, {\n                        name = name,\n                        spec = specID,\n                        gain = aura_env.piList[aura_env.configToCount[aura_env.config.targetCount]][specID].gain\n                })\n            end\n    end \n        aura_env.sortPiValues(dpsList)\n            aura_env.dpsList = dpsList\n            return true\n        end\n        \n        \n    end\n    \nend\n\n\n',
        events: "CHAT_MSG_PARTY, CHAT_MSG_PARTY_LEADER, CHAT_MSG_RAID, CHAT_MSG_RAID_LEADER, CHAT_MSG_INSTANCE_CHAT, CHAT_MSG_INSTANCE_CHAT_LEADER"
      }
    }
  ],
  authorOptions: {
    "1": {
      type: "toggle",
      key: "disableTargetCountReminder",
      width: 1,
      default: false,
      name: "disable change target count reminder",
      useDesc: true,
      desc: "Disables the target count change reminder"
    },
    "2": {
      desc: "Sets the target count for which pi values should be send in chat.",
      type: "select",
      key: "targetCount",
      values: {
        "1": "1",
        "2": "3",
        "3": "5",
        "4": "8",
        "5": "15"
      },
      useDesc: true,
      name: "target Count",
      default: 1,
      width: 1
    },
    "3": {
      type: "toggle",
      key: "disableLastUpdated",
      desc: "Disables the last updated msg in chat",
      useDesc: true,
      name: "disable Last Updated Info",
      default: false,
      width: 1
    }
  }
};

// data/pi_values.json
var pi_values_default = [
  {
    class: "Hunter",
    spec: "Marksmanship",
    specId: 254,
    targets: 3,
    talents: "C4PAAAAAAAAAAAAAAAAAAAAAAYMbDMgJY2YJwsAAAAAAAAAAAAAAzYGzYmZYGZGjhZGmlhZZZGsNMjxy2mZmZMLmZYMzMLbGWGmZA",
    dps_no_pi: 1044848766e-2,
    dps_with_pi: 107734255e-1,
    dps_delta: 324937.84,
    dps_pct_gain: 3.11,
    pi_dep_spell_ids: {
      "288613": 288613
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 185842,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_misc_silverjadenecklace.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 245965,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237645,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 219341,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237732,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_bow_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "Marksmanship",
    specId: 254,
    targets: 15,
    talents: "C4PAAAAAAAAAAAAAAAAAAAAAAYMbDMgJY2YJwsAAAAAAAAAAAAAAzYGzYmZYGZGjhZGmlhZZZGsNMjxy2mZmZMLmZYMzMLbGWGmZA",
    dps_no_pi: 3011470359e-2,
    dps_with_pi: 3114544789e-2,
    dps_delta: 10307443e-1,
    dps_pct_gain: 3.42,
    pi_dep_spell_ids: {
      "288613": 288613
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 185842,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_misc_silverjadenecklace.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 245965,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237645,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 219341,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237732,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_bow_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "Marksmanship",
    specId: 254,
    targets: 5,
    talents: "C4PAAAAAAAAAAAAAAAAAAAAAAYMbDMgJY2YJwsAAAAAAAAAAAAAAzYGzYmZYGZGjhZGmlhZZZGsNMjxy2mZmZMLmZYMzMLbGWGmZA",
    dps_no_pi: 1696371996e-2,
    dps_with_pi: 1751053882e-2,
    dps_delta: 546818.85,
    dps_pct_gain: 3.22,
    pi_dep_spell_ids: {
      "288613": 288613
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 185842,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_misc_silverjadenecklace.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 245965,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237645,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 219341,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237732,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_bow_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "Marksmanship",
    specId: 254,
    targets: 8,
    talents: "C4PAAAAAAAAAAAAAAAAAAAAAAYMbDMgJY2YJwsAAAAAAAAAAAAAAzYGzYmZYGZGjhZGmlhZZZGsNMjxy2mZmZMLmZYMzMLbGWGmZA",
    dps_no_pi: 2691809367e-2,
    dps_with_pi: 2785444941e-2,
    dps_delta: 936355.74,
    dps_pct_gain: 3.48,
    pi_dep_spell_ids: {
      "288613": 288613
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 185842,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_misc_silverjadenecklace.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 245965,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237645,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 219341,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237732,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_bow_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "Marksmanship",
    specId: 254,
    targets: 1,
    talents: "C4PAAAAAAAAAAAAAAAAAAAAAAYMbDMgJY2YLwsAAAAAAAAAAAAAAzYGzMzMDzoZGjhZGYYWWmBLjZGYbzMzMmFzMMzMzssZMLDmB",
    dps_no_pi: 600914279e-2,
    dps_with_pi: 617448937e-2,
    dps_delta: 165346.58,
    dps_pct_gain: 2.75,
    pi_dep_spell_ids: {
      "288613": 288613
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 237522,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_mail_raidhunterethereal_d_01.jpg"
      },
      legs: {
        id: 237645,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 219341,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237732,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_bow_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "BeastMastery",
    specId: 253,
    targets: 5,
    talents: "C0PAAAAAAAAAAAAAAAAAAAAAAYMLDMgBMbsFyYBAAAAAAzM2mBzMDmZYmlZmZmBzYmMjZMjZmhZGGGDzMMLDz2yMYDAAAAAAmB",
    dps_no_pi: 1493817161e-2,
    dps_with_pi: 1551577143e-2,
    dps_delta: 577599.83,
    dps_pct_gain: 3.87,
    pi_dep_spell_ids: {
      "19574": 19574
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 219339,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 238032,
        bonus_ids: [
          "10255",
          "10356",
          "10844",
          "12239",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidevokerethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213485"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237647,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidhunterethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 185783,
        bonus_ids: [
          "10042",
          "10255",
          "10384",
          "10390",
          "13446",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_crossbow_2h_broker_c_01.jpg"
      },
      finger1: {
        id: 242405,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring02_etherealribbonorrunestyle_gold.jpg"
      },
      finger2: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10389",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213485"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "BeastMastery",
    specId: 253,
    targets: 15,
    talents: "C0PAAAAAAAAAAAAAAAAAAAAAAYMLDMgBMbsFyYBAAAAAAzM2mBzMDmZYmlZmZmBzYmMjZMjZmhZGGGDzMMLDz2yMYDAAAAAAmB",
    dps_no_pi: 3502857505e-2,
    dps_with_pi: 3637229508e-2,
    dps_delta: 134372003e-2,
    dps_pct_gain: 3.84,
    pi_dep_spell_ids: {
      "19574": 19574
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 219339,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 238032,
        bonus_ids: [
          "10255",
          "10356",
          "10844",
          "12239",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidevokerethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213485"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237647,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidhunterethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 185783,
        bonus_ids: [
          "10042",
          "10255",
          "10384",
          "10390",
          "13446",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_crossbow_2h_broker_c_01.jpg"
      },
      finger1: {
        id: 242405,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring02_etherealribbonorrunestyle_gold.jpg"
      },
      finger2: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10389",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213485"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "BeastMastery",
    specId: 253,
    targets: 8,
    talents: "C0PAAAAAAAAAAAAAAAAAAAAAAYMLDMgBMbsFyYBAAAAAAzM2mBzMDmZYmlZmZmBzYmMjZMjZmhZGGGDzMMLDz2yMYDAAAAAAmB",
    dps_no_pi: 2245722687e-2,
    dps_with_pi: 2333591373e-2,
    dps_delta: 878686.86,
    dps_pct_gain: 3.91,
    pi_dep_spell_ids: {
      "19574": 19574
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 219339,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 238032,
        bonus_ids: [
          "10255",
          "10356",
          "10844",
          "12239",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidevokerethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213485"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237647,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidhunterethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 185783,
        bonus_ids: [
          "10042",
          "10255",
          "10384",
          "10390",
          "13446",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_crossbow_2h_broker_c_01.jpg"
      },
      finger1: {
        id: 242405,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring02_etherealribbonorrunestyle_gold.jpg"
      },
      finger2: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10389",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213485"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "BeastMastery",
    specId: 253,
    targets: 3,
    talents: "C0PAAAAAAAAAAAAAAAAAAAAAAYMLDMgBMbsFyYBAAAAAAzM2mBzMDmZYmlZmZmBzYmMjZMjZmhZGGGDzMMLDz2yMYDAAAAAAmB",
    dps_no_pi: 101974614e-1,
    dps_with_pi: 1056881414e-2,
    dps_delta: 371352.74,
    dps_pct_gain: 3.64,
    pi_dep_spell_ids: {
      "19574": 19574
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 219339,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 238032,
        bonus_ids: [
          "10255",
          "10356",
          "10844",
          "12239",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidevokerethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213485"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237647,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidhunterethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 185783,
        bonus_ids: [
          "10042",
          "10255",
          "10384",
          "10390",
          "13446",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_crossbow_2h_broker_c_01.jpg"
      },
      finger1: {
        id: 242405,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring02_etherealribbonorrunestyle_gold.jpg"
      },
      finger2: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10389",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213485"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "BeastMastery",
    specId: 253,
    targets: 1,
    talents: "C0PAAAAAAAAAAAAAAAAAAAAAAYMbDMgBMbsFyYBAAAAAAzY2GmlZGMjZMzyYmZGMjZyMmxMzMzwMjZYMMzADz2yMYDAAAAAAmB",
    dps_no_pi: 608584676e-2,
    dps_with_pi: 630996891e-2,
    dps_delta: 224122.15,
    dps_pct_gain: 3.68,
    pi_dep_spell_ids: {
      "19574": 19574
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 237522,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_mail_raidhunterethereal_d_01.jpg"
      },
      legs: {
        id: 237645,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237647,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidhunterethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 185783,
        bonus_ids: [
          "10042",
          "10255",
          "10384",
          "10390",
          "13446",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_crossbow_2h_broker_c_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 221136,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [
          "213485",
          "213485"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_11_0_nerubian_ring_01_color4.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "Survival",
    specId: 255,
    targets: 1,
    talents: "C8PAAAAAAAAAAAAAAAAAAAAAAMgxMG2ILwMM0glZmZZGzMjZmxYYMMzMzY2GAAAAAAQzYGzYmZYGmhxwMDjhZbZGsBAAAAADAA",
    dps_no_pi: 583320614e-2,
    dps_with_pi: 610988926e-2,
    dps_delta: 276683.11,
    dps_pct_gain: 4.74,
    pi_dep_spell_ids: {
      "360952": 360952
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 237554,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_mail_raidshamanethereal_d_01.jpg"
      },
      legs: {
        id: 237645,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7391"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 219341,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237739,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_polearm_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "Survival",
    specId: 255,
    targets: 3,
    talents: "C8PAAAAAAAAAAAAAAAAAAAAAAMGYglxoxyAY2C2mZsMzMzMzwYmZmxYMmZMLAAAAAAANjZMjZmhZYGGDzMMGmllZwGAAAAAMAA",
    dps_no_pi: 1049093245e-2,
    dps_with_pi: 108098352e-1,
    dps_delta: 318902.75,
    dps_pct_gain: 3.04,
    pi_dep_spell_ids: {
      "360952": 360952
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 219339,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237645,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 219341,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237739,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_polearm_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10354",
          "10396",
          "10844",
          "10879",
          "12297",
          "1514",
          "1754",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 232541,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1566",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/ability_blackhand_attachedslagbombs.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "Survival",
    specId: 255,
    targets: 8,
    talents: "C8PAAAAAAAAAAAAAAAAAAAAAAMGYglxoxyAY2C2mZsMzMzMzwYmZmxYMmZMLAAAAAAANjZMjZmhZYGGDzMMGmllZwGAAAAAMAA",
    dps_no_pi: 236067419e-1,
    dps_with_pi: 2444527172e-2,
    dps_delta: 838529.82,
    dps_pct_gain: 3.55,
    pi_dep_spell_ids: {
      "360952": 360952
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 219339,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237645,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 219341,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237739,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_polearm_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10354",
          "10396",
          "10844",
          "10879",
          "12297",
          "1514",
          "1754",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 232541,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1566",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/ability_blackhand_attachedslagbombs.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "Survival",
    specId: 255,
    targets: 15,
    talents: "C8PAAAAAAAAAAAAAAAAAAAAAAMGYglxoxyAY2C2mZsMzMzMzwYmZmxYMmZMLAAAAAAANjZMjZmhZYGGDzMMGmllZwGAAAAAMAA",
    dps_no_pi: 3143293408e-2,
    dps_with_pi: 3256171719e-2,
    dps_delta: 112878311e-2,
    dps_pct_gain: 3.59,
    pi_dep_spell_ids: {
      "360952": 360952
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 219339,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237645,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 219341,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237739,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_polearm_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10354",
          "10396",
          "10844",
          "10879",
          "12297",
          "1514",
          "1754",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 232541,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1566",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/ability_blackhand_attachedslagbombs.jpg"
      }
    }
  },
  {
    class: "Hunter",
    spec: "Survival",
    specId: 255,
    targets: 5,
    talents: "C8PAAAAAAAAAAAAAAAAAAAAAAMGYglxoxyAY2C2mZsMzMzMzwYmZmxYMmZMLAAAAAAANjZMjZmhZYGGDzMMGmllZwGAAAAAMAA",
    dps_no_pi: 1670175459e-2,
    dps_with_pi: 1728959889e-2,
    dps_delta: 587844.3,
    dps_pct_gain: 3.52,
    pi_dep_spell_ids: {
      "360952": 360952
    },
    gear: {
      head: {
        id: 237646,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidhunterethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237644,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237649,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 219339,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237645,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 219341,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237739,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_polearm_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10354",
          "10396",
          "10844",
          "10879",
          "12297",
          "1514",
          "1754",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 232541,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1566",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/ability_blackhand_attachedslagbombs.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Assassination",
    specId: 259,
    targets: 1,
    talents: "CMQAAAAAAAAAAAAAAAAAAAAAAMjZmhxMYAAAAAAYWGsMDAAAAAAttNzMmZmBzMzysNzMjZwwMzMmZzyYGADsAzY0Y2AZbAbA",
    dps_no_pi: 59082205e-1,
    dps_with_pi: 605067576e-2,
    dps_delta: 142455.26,
    dps_pct_gain: 2.41,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237662,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237665,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidrogueethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 222438,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Assassination",
    specId: 259,
    targets: 5,
    talents: "CMQAAAAAAAAAAAAAAAAAAAAAAYmZMzMmBAAAAAAYWmxsMDAAAAAAttMzMYmBzMzysNYMmZmZmZmZYzyYGgNzyADYJYbYCMsMA",
    dps_no_pi: 1913452837e-2,
    dps_with_pi: 1991361062e-2,
    dps_delta: 779082.25,
    dps_pct_gain: 4.07,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12361",
          "12676",
          "12921",
          "1533",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 251880,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "1579",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace02_etherealribbonorrunestyle_dark.jpg"
      },
      shoulder: {
        id: 237662,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12361",
          "12921",
          "1533",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237665,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidrogueethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10520",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Assassination",
    specId: 259,
    targets: 15,
    talents: "CMQAAAAAAAAAAAAAAAAAAAAAAYmZMzMmBAAAAAAYWmxsMDAAAAAAttMzMYmBzMzysNYMmZmZmZmZYzyYGgNzyADYJYbYCMsMA",
    dps_no_pi: 3450024186e-2,
    dps_with_pi: 3596477697e-2,
    dps_delta: 14645351e-1,
    dps_pct_gain: 4.24,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12361",
          "12676",
          "12921",
          "1533",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 251880,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "1579",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace02_etherealribbonorrunestyle_dark.jpg"
      },
      shoulder: {
        id: 237662,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12361",
          "12921",
          "1533",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237665,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidrogueethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10520",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Assassination",
    specId: 259,
    targets: 3,
    talents: "CMQAAAAAAAAAAAAAAAAAAAAAAYmZMzMmBAAAAAAYWmxsMDAAAAAAttMzMYmBzMzysNYMmZmZmZmZYzyYGgNzyADYJYbYCMsMA",
    dps_no_pi: 1165378631e-2,
    dps_with_pi: 1213295018e-2,
    dps_delta: 479163.87,
    dps_pct_gain: 4.11,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12361",
          "12676",
          "12921",
          "1533",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 251880,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "1579",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace02_etherealribbonorrunestyle_dark.jpg"
      },
      shoulder: {
        id: 237662,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12361",
          "12921",
          "1533",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237665,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidrogueethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10520",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Assassination",
    specId: 259,
    targets: 8,
    talents: "CMQAAAAAAAAAAAAAAAAAAAAAAYmZMzMmBAAAAAAYWmxsMDAAAAAAttMzMYmBzMzysNYMmZmZmZmZYzyYGgNzyADYJYbYCMsMA",
    dps_no_pi: 271504351e-1,
    dps_with_pi: 28285597,
    dps_delta: 11351619e-1,
    dps_pct_gain: 4.18,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12361",
          "12676",
          "12921",
          "1533",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 251880,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "1579",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace02_etherealribbonorrunestyle_dark.jpg"
      },
      shoulder: {
        id: 237662,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12361",
          "12921",
          "1533",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237665,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidrogueethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10520",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Subtlety",
    specId: 261,
    targets: 1,
    talents: "CUQAAAAAAAAAAAAAAAAAAAAAAAAM2mBAAAAAgZZMWmGzsMGzYMMMzMzwY2mlZM22mZmZmZGwYZ2GAAAAmBDgxsZYgBmFtQL2gB",
    dps_no_pi: 561851255e-2,
    dps_with_pi: 569430635e-2,
    dps_delta: 75793.8,
    dps_pct_gain: 1.35,
    pi_dep_spell_ids: {
      "185313": 185313
    },
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213473"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10520",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213473",
          "213473"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237552,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12365",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213473"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "10520",
          "12050",
          "12053",
          "12922",
          "13468",
          "8794",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213473"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237665,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidrogueethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213473",
          "213473"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Subtlety",
    specId: 261,
    targets: 8,
    talents: "CUQAAAAAAAAAAAAAAAAAAAAAAAAM2mBAAAAAgZZMWmGzYMmZGjZ8AzMjhxsNLGjtlZmBzMGjZWmtBAAAgZwAYMbGGYgZRL0iNYA",
    dps_no_pi: 2513296013e-2,
    dps_with_pi: 2552011036e-2,
    dps_delta: 387150.24,
    dps_pct_gain: 1.54,
    pi_dep_spell_ids: {
      "185313": 185313
    },
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10520",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237552,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 237660,
        bonus_ids: [
          "10255",
          "10356",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_bracer_leather_raidrogueethereal_d_01.jpg"
      },
      hands: {
        id: 237665,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidrogueethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213473",
          "213473"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213473",
          "213473"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Subtlety",
    specId: 261,
    targets: 3,
    talents: "CUQAAAAAAAAAAAAAAAAAAAAAAAAM2mBAAAAAgZZMWmGzYMmZGjZ8AzMjhxsNLGjtlZmBzMGjZWmtBAAAgZwAYMbGGYgZRL0iNYA",
    dps_no_pi: 1096495425e-2,
    dps_with_pi: 1116659089e-2,
    dps_delta: 201636.64,
    dps_pct_gain: 1.84,
    pi_dep_spell_ids: {
      "185313": 185313
    },
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10520",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237552,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 237660,
        bonus_ids: [
          "10255",
          "10356",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_bracer_leather_raidrogueethereal_d_01.jpg"
      },
      hands: {
        id: 237665,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidrogueethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213473",
          "213473"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213473",
          "213473"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Subtlety",
    specId: 261,
    targets: 5,
    talents: "CUQAAAAAAAAAAAAAAAAAAAAAAAAM2mBAAAAAgZZMWmGzYMmZGjZ8AzMjhxsNLGjtlZmBzMGjZWmtBAAAgZwAYMbGGYgZRL0iNYA",
    dps_no_pi: 1696956014e-2,
    dps_with_pi: 1728456052e-2,
    dps_delta: 315000.38,
    dps_pct_gain: 1.86,
    pi_dep_spell_ids: {
      "185313": 185313
    },
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10520",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237552,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 237660,
        bonus_ids: [
          "10255",
          "10356",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_bracer_leather_raidrogueethereal_d_01.jpg"
      },
      hands: {
        id: 237665,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidrogueethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213473",
          "213473"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213473",
          "213473"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Subtlety",
    specId: 261,
    targets: 15,
    talents: "CUQAAAAAAAAAAAAAAAAAAAAAAAAM2mBAAAAAgZZMWmGzYMmZGjZ8AzMjhxsNLGjtlZmBzMGjZWmtBAAAgZwAYMbGGYgZRL0iNYA",
    dps_no_pi: 2829268606e-2,
    dps_with_pi: 2890833374e-2,
    dps_delta: 615647.68,
    dps_pct_gain: 2.18,
    pi_dep_spell_ids: {
      "185313": 185313
    },
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10520",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237552,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 237660,
        bonus_ids: [
          "10255",
          "10356",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_bracer_leather_raidrogueethereal_d_01.jpg"
      },
      hands: {
        id: 237665,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidrogueethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237729,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213473",
          "213473"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213473",
          "213473"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Outlaw",
    specId: 260,
    targets: 15,
    talents: "CQQAAAAAAAAAAAAAAAAAAAAAAAAM2mBjZGzMzMDzwDMmZmhZmZmWmxsNDAAAAAA2WmZGMzYWglZbAAAAYmZAwY2MMkBmFWoF2MA",
    dps_no_pi: 2092452714e-2,
    dps_with_pi: 2092238586e-2,
    dps_delta: -2141.28,
    dps_pct_gain: -0.01,
    pi_dep_spell_ids: {
      "13750": 13750
    },
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237662,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 238027,
        bonus_ids: [
          "10255",
          "10356",
          "10844",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raiddemonhunterethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 237660,
        bonus_ids: [
          "10255",
          "10356",
          "12365",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467"
        ],
        enchant_ids: [
          "7391"
        ],
        icon: "data/icons/inv_bracer_leather_raidrogueethereal_d_01.jpg"
      },
      hands: {
        id: 219333,
        bonus_ids: [
          "10421",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 221144,
        bonus_ids: [
          "10255",
          "10384",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_sword_1h_earthendungeon_c_02.jpg"
      },
      off_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10520",
          "10879",
          "12050",
          "12053",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 230632,
        bonus_ids: [
          "10255",
          "10834",
          "10836",
          "12033",
          "12034",
          "12297",
          "1592"
        ],
        gem_ids: [
          "213461",
          "213494"
        ],
        enchant_ids: [
          "7476"
        ],
        icon: "data/icons/inv_11_0_arathor_ring_01_color5.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242397,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_agidpsancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Outlaw",
    specId: 260,
    targets: 1,
    talents: "CQQAAAAAAAAAAAAAAAAAAAAAAAAM2mBjZmZmZmZYGGMjhZmZmWmxsNDAAAAAAsNzMDzMjFYZ2GAAAAmZGwAbwMGNmNAbTYxMA",
    dps_no_pi: 447616393e-2,
    dps_with_pi: 447702635e-2,
    dps_delta: 862.41,
    dps_pct_gain: 0.02,
    pi_dep_spell_ids: {
      "13750": 13750
    },
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237662,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "10520",
          "12050",
          "12053",
          "12921",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 237660,
        bonus_ids: [
          "10255",
          "10356",
          "12365",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_bracer_leather_raidrogueethereal_d_01.jpg"
      },
      hands: {
        id: 237665,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidrogueethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7463"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7460"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 185813,
        bonus_ids: [
          "10029",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13444",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7476"
        ],
        icon: "data/icons/inv_jewelcrafting_80_maxlvlring_blue.jpg"
      },
      trinket1: {
        id: 242397,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_agidpsancientkareshirelic.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Outlaw",
    specId: 260,
    targets: 3,
    talents: "CQQAAAAAAAAAAAAAAAAAAAAAAAAM2mBjZGzMzMDzwDMmZmhZmZmWmxsNDAAAAAA2WmZGMzYWglZbAAAAYmZAwY2MMkBmFWoF2MA",
    dps_no_pi: 1093757706e-2,
    dps_with_pi: 1094003036e-2,
    dps_delta: 2453.3,
    dps_pct_gain: 0.02,
    pi_dep_spell_ids: {
      "13750": 13750
    },
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237662,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 238027,
        bonus_ids: [
          "10255",
          "10356",
          "10844",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raiddemonhunterethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 237660,
        bonus_ids: [
          "10255",
          "10356",
          "12365",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467"
        ],
        enchant_ids: [
          "7391"
        ],
        icon: "data/icons/inv_bracer_leather_raidrogueethereal_d_01.jpg"
      },
      hands: {
        id: 219333,
        bonus_ids: [
          "10421",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 221144,
        bonus_ids: [
          "10255",
          "10384",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_sword_1h_earthendungeon_c_02.jpg"
      },
      off_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10520",
          "10879",
          "12050",
          "12053",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 230632,
        bonus_ids: [
          "10255",
          "10834",
          "10836",
          "12033",
          "12034",
          "12297",
          "1592"
        ],
        gem_ids: [
          "213461",
          "213494"
        ],
        enchant_ids: [
          "7476"
        ],
        icon: "data/icons/inv_11_0_arathor_ring_01_color5.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242397,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_agidpsancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Outlaw",
    specId: 260,
    targets: 8,
    talents: "CQQAAAAAAAAAAAAAAAAAAAAAAAAM2mBjZGzMzMDzwDMmZmhZmZmWmxsNDAAAAAA2WmZGMzYWglZbAAAAYmZAwY2MMkBmFWoF2MA",
    dps_no_pi: 2098993915e-2,
    dps_with_pi: 2099416112e-2,
    dps_delta: 4221.97,
    dps_pct_gain: 0.02,
    pi_dep_spell_ids: {
      "13750": 13750
    },
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237662,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 238027,
        bonus_ids: [
          "10255",
          "10356",
          "10844",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raiddemonhunterethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 237660,
        bonus_ids: [
          "10255",
          "10356",
          "12365",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467"
        ],
        enchant_ids: [
          "7391"
        ],
        icon: "data/icons/inv_bracer_leather_raidrogueethereal_d_01.jpg"
      },
      hands: {
        id: 219333,
        bonus_ids: [
          "10421",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 221144,
        bonus_ids: [
          "10255",
          "10384",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_sword_1h_earthendungeon_c_02.jpg"
      },
      off_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10520",
          "10879",
          "12050",
          "12053",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 230632,
        bonus_ids: [
          "10255",
          "10834",
          "10836",
          "12033",
          "12034",
          "12297",
          "1592"
        ],
        gem_ids: [
          "213461",
          "213494"
        ],
        enchant_ids: [
          "7476"
        ],
        icon: "data/icons/inv_11_0_arathor_ring_01_color5.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242397,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_agidpsancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Rogue",
    spec: "Outlaw",
    specId: 260,
    targets: 5,
    talents: "CQQAAAAAAAAAAAAAAAAAAAAAAAAM2mBjZGzMzMDzwDMmZmhZmZmWmxsNDAAAAAA2WmZGMzYWglZbAAAAYmZAwY2MMkBmFWoF2MA",
    dps_no_pi: 1655972335e-2,
    dps_with_pi: 1655739806e-2,
    dps_delta: -2325.29,
    dps_pct_gain: -0.01,
    pi_dep_spell_ids: {
      "13750": 13750
    },
    gear: {
      head: {
        id: 237664,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidrogueethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237662,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237667,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidrogueethereal_d_01.jpg"
      },
      waist: {
        id: 238027,
        bonus_ids: [
          "10255",
          "10356",
          "10844",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raiddemonhunterethereal_d_01.jpg"
      },
      legs: {
        id: 237663,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidrogueethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 237660,
        bonus_ids: [
          "10255",
          "10356",
          "12365",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467"
        ],
        enchant_ids: [
          "7391"
        ],
        icon: "data/icons/inv_bracer_leather_raidrogueethereal_d_01.jpg"
      },
      hands: {
        id: 219333,
        bonus_ids: [
          "10421",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 221144,
        bonus_ids: [
          "10255",
          "10384",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_sword_1h_earthendungeon_c_02.jpg"
      },
      off_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10520",
          "10879",
          "12050",
          "12053",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 230632,
        bonus_ids: [
          "10255",
          "10834",
          "10836",
          "12033",
          "12034",
          "12297",
          "1592"
        ],
        gem_ids: [
          "213461",
          "213494"
        ],
        enchant_ids: [
          "7476"
        ],
        icon: "data/icons/inv_11_0_arathor_ring_01_color5.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242397,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_agidpsancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Arcane",
    specId: 62,
    targets: 1,
    talents: "C4DAAAAAAAAAAAAAAAAAAAAAAYMMbzgZ8AjZxwYmhx0MjZAAAAAAYAAzMTLz2yMAQsBAAAAAAAwgZWmlZmZGjZMzMzMjZYZM",
    dps_no_pi: 614616125e-2,
    dps_with_pi: 632640723e-2,
    dps_delta: 180245.98,
    dps_pct_gain: 2.93,
    pi_dep_spell_ids: {
      "365362": 365362
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 237538,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_cloth_raidwarlockethereal_d_01.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7531"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12922",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 242405,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213461"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring02_etherealribbonorrunestyle_gold.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213470",
          "213470"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Arcane",
    specId: 62,
    targets: 8,
    talents: "C4DAAAAAAAAAAAAAAAAAAAAAAYGMbzgZYmZBGzMMmmZWmBAAAAAgBAMzMtMbLzAAxGAAAAAAbAYMYmlZZGzMGzwMzMzYGzyYA",
    dps_no_pi: 2038893807e-2,
    dps_with_pi: 209225585e-1,
    dps_delta: 533620.43,
    dps_pct_gain: 2.62,
    pi_dep_spell_ids: {
      "365362": 365362
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7531"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10844",
          "10879",
          "13446",
          "1540",
          "1781",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213467"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      finger2: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10389",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213491"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      trinket1: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Arcane",
    specId: 62,
    targets: 5,
    talents: "C4DAAAAAAAAAAAAAAAAAAAAAAYGMbzgZYmZBGzMMmmZWmBAAAAAgBAMzMtMbLzAAxGAAAAAAbAYMYmlZZGzMGzwMzMzYGzyYA",
    dps_no_pi: 1853125653e-2,
    dps_with_pi: 1902866419e-2,
    dps_delta: 497407.66,
    dps_pct_gain: 2.68,
    pi_dep_spell_ids: {
      "365362": 365362
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7531"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10844",
          "10879",
          "13446",
          "1540",
          "1781",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213467"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      finger2: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10389",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213491"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      trinket1: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Arcane",
    specId: 62,
    targets: 15,
    talents: "C4DAAAAAAAAAAAAAAAAAAAAAAYGMbzgZYmZBGzMMmmZWmBAAAAAgBAMzMtMbLzAAxGAAAAAAbAYMYmlZZGzMGzwMzMzYGzyYA",
    dps_no_pi: 2268249036e-2,
    dps_with_pi: 2324953501e-2,
    dps_delta: 567044.64,
    dps_pct_gain: 2.5,
    pi_dep_spell_ids: {
      "365362": 365362
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7531"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10844",
          "10879",
          "13446",
          "1540",
          "1781",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213467"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      finger2: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10389",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213491"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      trinket1: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Arcane",
    specId: 62,
    targets: 3,
    talents: "C4DAAAAAAAAAAAAAAAAAAAAAAYGMbzgZYmZBGzMMmmZWmBAAAAAgBAMzMtMbLzAAxGAAAAAAbAYMYmlZZGzMGzwMzMzYGzyYA",
    dps_no_pi: 1174652237e-2,
    dps_with_pi: 120074829e-1,
    dps_delta: 260960.53,
    dps_pct_gain: 2.22,
    pi_dep_spell_ids: {
      "365362": 365362
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7531"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10844",
          "10879",
          "13446",
          "1540",
          "1781",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213467"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      finger2: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10389",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213491"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      trinket1: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Frost",
    specId: 64,
    targets: 8,
    talents: "CAEAAAAAAAAAAAAAAAAAAAAAAMzYzsZwMMzsNDMzoxYMmZmhhZwDMzMzMzMzMzMmZmxMzyMNzsNLAAAoFAAAAAAMLAAAAAAAAA",
    dps_no_pi: 2242643366e-2,
    dps_with_pi: 2276966254e-2,
    dps_delta: 343228.88,
    dps_pct_gain: 1.53,
    pi_dep_spell_ids: {
      "12472": 12472
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 221136,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_nerubian_ring_01_color4.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Frost",
    specId: 64,
    targets: 5,
    talents: "CAEAAAAAAAAAAAAAAAAAAAAAAMzYzsZwMMzsNDMzoxYMmZmhhZwDMzMzMzMzMzMmZmxMzyMNzsNLAAAoFAAAAAAMLAAAAAAAAA",
    dps_no_pi: 1599458712e-2,
    dps_with_pi: 1624093967e-2,
    dps_delta: 246352.55,
    dps_pct_gain: 1.54,
    pi_dep_spell_ids: {
      "12472": 12472
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 221136,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_nerubian_ring_01_color4.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Frost",
    specId: 64,
    targets: 3,
    talents: "CAEAAAAAAAAAAAAAAAAAAAAAAMzYzsZwMMzsNDMzoxYMmZmhhZwDMzMzMzMzMzMmZmxMzyMNzsNLAAAoFAAAAAAMLAAAAAAAAA",
    dps_no_pi: 117874691e-1,
    dps_with_pi: 1201000405e-2,
    dps_delta: 222534.95,
    dps_pct_gain: 1.89,
    pi_dep_spell_ids: {
      "12472": 12472
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 221136,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_nerubian_ring_01_color4.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Frost",
    specId: 64,
    targets: 1,
    talents: "CAEAAAAAAAAAAAAAAAAAAAAAAYGbsZ8AmhxsYwMzoxYmxMjhZmZYmZmZmxMzMzMzMDMzyMNzsNLAAAoFAAAAAAMAAAAAAAAA",
    dps_no_pi: 631743323e-2,
    dps_with_pi: 643599125e-2,
    dps_delta: 118558.02,
    dps_pct_gain: 1.88,
    pi_dep_spell_ids: {
      "12472": 12472
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 221136,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [
          "213485",
          "213485"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_11_0_nerubian_ring_01_color4.jpg"
      },
      trinket1: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Frost",
    specId: 64,
    targets: 15,
    talents: "CAEAAAAAAAAAAAAAAAAAAAAAAMzYzsZwMMzsNDMzoxYMmZmhhZwDMzMzMzMzMzMmZmxMzyMNzsNLAAAoFAAAAAAMLAAAAAAAAA",
    dps_no_pi: 3165523338e-2,
    dps_with_pi: 3209501163e-2,
    dps_delta: 439778.26,
    dps_pct_gain: 1.39,
    pi_dep_spell_ids: {
      "12472": 12472
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8795",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 221136,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_nerubian_ring_01_color4.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Fire",
    specId: 63,
    targets: 1,
    talents: "C8DAAAAAAAAAAAAAAAAAAAAAAYGMbzgZMjZxDwYmhpxMjZAAAAAAYgAmZmWmllZAA2MmBjZGzMmFzyYYmhZ2mhZWGGAAAAAAA",
    dps_no_pi: 600001755e-2,
    dps_with_pi: 624705729e-2,
    dps_delta: 247039.73,
    dps_pct_gain: 4.12,
    pi_dep_spell_ids: {
      "190319": 190319
    },
    gear: {
      head: {
        id: 238033,
        bonus_ids: [
          "10255",
          "10356",
          "10844",
          "12239",
          "12365",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 237538,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12365",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_belt_cloth_raidwarlockethereal_d_01.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7531"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12922",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213485"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237735,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_sword_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 242405,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213485",
          "213485"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring02_etherealribbonorrunestyle_gold.jpg"
      },
      trinket1: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Fire",
    specId: 63,
    targets: 5,
    talents: "C8DAAAAAAAAAAAAAAAAAAAAAAMzAbGMDzMLeA8AzMjpxMjZGAAAAAADEwMz0yssNDAwmZmBjZGmxsYWGDzMbmZbGLzsgBAAAAAAA",
    dps_no_pi: 1411591001e-2,
    dps_with_pi: 1470793441e-2,
    dps_delta: 592024.4,
    dps_pct_gain: 4.19,
    pi_dep_spell_ids: {
      "190319": 190319
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 242491,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13444",
          "3209",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring01_etherealnontechnologicalstyle_gold.jpg"
      },
      trinket1: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      },
      trinket2: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Fire",
    specId: 63,
    targets: 8,
    talents: "C8DAAAAAAAAAAAAAAAAAAAAAAMzAbGMDzMLeA8AzMjpxMjZGAAAAAADEwMz0yssNDAwmZmBjZGmxsYWGDzMbmZbGLzsgBAAAAAAA",
    dps_no_pi: 2062413796e-2,
    dps_with_pi: 2149686879e-2,
    dps_delta: 872730.83,
    dps_pct_gain: 4.23,
    pi_dep_spell_ids: {
      "190319": 190319
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 242491,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13444",
          "3209",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring01_etherealnontechnologicalstyle_gold.jpg"
      },
      trinket1: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      },
      trinket2: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Fire",
    specId: 63,
    targets: 15,
    talents: "C8DAAAAAAAAAAAAAAAAAAAAAAMzAbGMDzMLeA8AzMjpxMjZGAAAAAADEwMz0yssNDAwmZmBjZGmxsYWGDzMbmZbGLzsgBAAAAAAA",
    dps_no_pi: 2787545183e-2,
    dps_with_pi: 2910783811e-2,
    dps_delta: 123238627e-2,
    dps_pct_gain: 4.42,
    pi_dep_spell_ids: {
      "190319": 190319
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 242491,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13444",
          "3209",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring01_etherealnontechnologicalstyle_gold.jpg"
      },
      trinket1: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      },
      trinket2: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Mage",
    spec: "Fire",
    specId: 63,
    targets: 3,
    talents: "C8DAAAAAAAAAAAAAAAAAAAAAAMzAbGMDzMLeA8AzMjpxMjZGAAAAAADEwMz0yssNDAwmZmBjZGmxsYWGDzMbmZbGLzsgBAAAAAAA",
    dps_no_pi: 1100332628e-2,
    dps_with_pi: 1146689628e-2,
    dps_delta: 463569.99,
    dps_pct_gain: 4.21,
    pi_dep_spell_ids: {
      "190319": 190319
    },
    gear: {
      head: {
        id: 237718,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidmageethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237716,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidmageethereal_d_01.jpg"
      },
      chest: {
        id: 237721,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidmageethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237717,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidmageethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237719,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidmageethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 242491,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13444",
          "3209",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring01_etherealnontechnologicalstyle_gold.jpg"
      },
      trinket1: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      },
      trinket2: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "DeathKnight",
    spec: "Frost",
    specId: 251,
    targets: 1,
    talents: "CsPAAAAAAAAAAAAAAAAAAAAAAMDgZGzMjxYZYmZmZmxMzIGjxwMDwMzMzMzMzAAAAAAAAAAAgxy2ADYBsMMhMWwMzMzMDMM",
    dps_no_pi: 613618497e-2,
    dps_with_pi: 634589181e-2,
    dps_delta: 209706.84,
    dps_pct_gain: 3.42,
    pi_dep_spell_ids: {
      "51271": 51271,
      "152279": 152279
    },
    gear: {
      head: {
        id: 237628,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raiddeathknightethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237626,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raiddeathknightethereal_d_01.jpg"
      },
      chest: {
        id: 237631,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raiddeathknightethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237627,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_plate_raiddeathknightethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7418"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 222437,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "3368"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213473",
          "213482"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "DeathKnight",
    spec: "Frost",
    specId: 251,
    targets: 15,
    talents: "CsPAAAAAAAAAAAAAAAAAAAAAAMDwMzYGjxwYmZmZmhZmRzMGjhZGgZmZmZmZmBAAAAAAAAAAAjltBGwCYZYCZsgZmZMzADD",
    dps_no_pi: 3888385408e-2,
    dps_with_pi: 4026519948e-2,
    dps_delta: 13813454e-1,
    dps_pct_gain: 3.55,
    pi_dep_spell_ids: {
      "51271": 51271,
      "152279": 152279
    },
    gear: {
      head: {
        id: 237628,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raiddeathknightethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237626,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raiddeathknightethereal_d_01.jpg"
      },
      chest: {
        id: 237631,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raiddeathknightethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237627,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_plate_raiddeathknightethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 222437,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "3368"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213497"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "DeathKnight",
    spec: "Frost",
    specId: 251,
    targets: 3,
    talents: "CsPAAAAAAAAAAAAAAAAAAAAAAMDwMzYGjxwYmZmZmhZmRzMGjhZGgZmZmZmZmBAAAAAAAAAAAjltBGwCYZYCZsgZmZMzADD",
    dps_no_pi: 1190301792e-2,
    dps_with_pi: 1232376235e-2,
    dps_delta: 420744.42,
    dps_pct_gain: 3.53,
    pi_dep_spell_ids: {
      "51271": 51271,
      "152279": 152279
    },
    gear: {
      head: {
        id: 237628,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raiddeathknightethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237626,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raiddeathknightethereal_d_01.jpg"
      },
      chest: {
        id: 237631,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raiddeathknightethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237627,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_plate_raiddeathknightethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 222437,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "3368"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213497"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "DeathKnight",
    spec: "Frost",
    specId: 251,
    targets: 5,
    talents: "CsPAAAAAAAAAAAAAAAAAAAAAAMDwMzYGjxwYmZmZmhZmRzMGjhZGgZmZmZmZmBAAAAAAAAAAAjltBGwCYZYCZsgZmZMzADD",
    dps_no_pi: 1828294659e-2,
    dps_with_pi: 1895044574e-2,
    dps_delta: 667499.16,
    dps_pct_gain: 3.65,
    pi_dep_spell_ids: {
      "51271": 51271,
      "152279": 152279
    },
    gear: {
      head: {
        id: 237628,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raiddeathknightethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237626,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raiddeathknightethereal_d_01.jpg"
      },
      chest: {
        id: 237631,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raiddeathknightethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237627,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_plate_raiddeathknightethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 222437,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "3368"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213497"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "DeathKnight",
    spec: "Frost",
    specId: 251,
    targets: 8,
    talents: "CsPAAAAAAAAAAAAAAAAAAAAAAMDwMzYGjxwYmZmZmhZmRzMGjhZGgZmZmZmZmBAAAAAAAAAAAjltBGwCYZYCZsgZmZMzADD",
    dps_no_pi: 2525087826e-2,
    dps_with_pi: 2615855076e-2,
    dps_delta: 907672.5,
    dps_pct_gain: 3.59,
    pi_dep_spell_ids: {
      "51271": 51271,
      "152279": 152279
    },
    gear: {
      head: {
        id: 237628,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raiddeathknightethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237626,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raiddeathknightethereal_d_01.jpg"
      },
      chest: {
        id: 237631,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raiddeathknightethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237627,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_plate_raiddeathknightethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 222437,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "3368"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213497"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "DeathKnight",
    spec: "Unholy",
    specId: 252,
    targets: 15,
    talents: "CwPAAAAAAAAAAAAAAAAAAAAAAAwMzYGzMzwMGzMTDzYMzMGAAAAAAAAmZmZDzYmBAsNDzY2mZmxYGgNzihhMwsxQjFMAzAYA",
    dps_no_pi: 3433913378e-2,
    dps_with_pi: 3545419065e-2,
    dps_delta: 111505687e-2,
    dps_pct_gain: 3.25,
    pi_dep_spell_ids: {
      "63560": 63560
    },
    gear: {
      head: {
        id: 237628,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raiddeathknightethereal_d_01.jpg"
      },
      neck: {
        id: 178827,
        bonus_ids: [
          "10039",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_7_0raid_necklace_03a.jpg"
      },
      shoulder: {
        id: 237626,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raiddeathknightethereal_d_01.jpg"
      },
      chest: {
        id: 237631,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raiddeathknightethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237627,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_plate_raiddeathknightethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 222437,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 242487,
        bonus_ids: [
          "10255",
          "10384",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "3368"
        ],
        icon: "data/icons/inv_sword_2h_outdoorethereal_c_01.jpg"
      },
      finger1: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 246344,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1602",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_qirajidol_onyx.jpg"
      }
    }
  },
  {
    class: "DeathKnight",
    spec: "Unholy",
    specId: 252,
    targets: 8,
    talents: "CwPAAAAAAAAAAAAAAAAAAAAAAAwMzYGzMzwMGzMTDzYMzMGAAAAAAAAmZmZDzYmBAsNDzY2mZmxYGgNzihhMwsxQjFMAzAYA",
    dps_no_pi: 2615250776e-2,
    dps_with_pi: 2712586973e-2,
    dps_delta: 973361.97,
    dps_pct_gain: 3.72,
    pi_dep_spell_ids: {
      "63560": 63560
    },
    gear: {
      head: {
        id: 237628,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raiddeathknightethereal_d_01.jpg"
      },
      neck: {
        id: 178827,
        bonus_ids: [
          "10039",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_7_0raid_necklace_03a.jpg"
      },
      shoulder: {
        id: 237626,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raiddeathknightethereal_d_01.jpg"
      },
      chest: {
        id: 237631,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raiddeathknightethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237627,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_plate_raiddeathknightethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 222437,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 242487,
        bonus_ids: [
          "10255",
          "10384",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "3368"
        ],
        icon: "data/icons/inv_sword_2h_outdoorethereal_c_01.jpg"
      },
      finger1: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 246344,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1602",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_qirajidol_onyx.jpg"
      }
    }
  },
  {
    class: "DeathKnight",
    spec: "Unholy",
    specId: 252,
    targets: 5,
    talents: "CwPAAAAAAAAAAAAAAAAAAAAAAAwMzYGzMzwMGzMTDzYMzMGAAAAAAAAmZmZDzYmBAsNDzY2mZmxYGgNzihhMwsxQjFMAzAYA",
    dps_no_pi: 1666872859e-2,
    dps_with_pi: 1727213388e-2,
    dps_delta: 603405.29,
    dps_pct_gain: 3.62,
    pi_dep_spell_ids: {
      "63560": 63560
    },
    gear: {
      head: {
        id: 237628,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raiddeathknightethereal_d_01.jpg"
      },
      neck: {
        id: 178827,
        bonus_ids: [
          "10039",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_7_0raid_necklace_03a.jpg"
      },
      shoulder: {
        id: 237626,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raiddeathknightethereal_d_01.jpg"
      },
      chest: {
        id: 237631,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raiddeathknightethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237627,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_plate_raiddeathknightethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 222437,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 242487,
        bonus_ids: [
          "10255",
          "10384",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "3368"
        ],
        icon: "data/icons/inv_sword_2h_outdoorethereal_c_01.jpg"
      },
      finger1: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 246344,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1602",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_qirajidol_onyx.jpg"
      }
    }
  },
  {
    class: "DeathKnight",
    spec: "Unholy",
    specId: 252,
    targets: 1,
    talents: "CwPAAAAAAAAAAAAAAAAAAAAAAAgZGzMjxwMmZmZaYmZmxMGAAAAAAAAmZmZhZGzAAmtZMzY2mZmBzAsYWMMkBmNGasAAzAYA",
    dps_no_pi: 653129751e-2,
    dps_with_pi: 68563031e-1,
    dps_delta: 325005.59,
    dps_pct_gain: 4.98,
    pi_dep_spell_ids: {
      "63560": 63560
    },
    gear: {
      head: {
        id: 237628,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raiddeathknightethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237626,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raiddeathknightethereal_d_01.jpg"
      },
      chest: {
        id: 237631,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raiddeathknightethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237627,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_plate_raiddeathknightethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7418"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237526,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_plate_raiddeathknightethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "3368"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 246344,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1602",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_qirajidol_onyx.jpg"
      }
    }
  },
  {
    class: "DeathKnight",
    spec: "Unholy",
    specId: 252,
    targets: 3,
    talents: "CwPAAAAAAAAAAAAAAAAAAAAAAAwMzYGzMzwMGzMTDzYMzMGAAAAAAAAmZmZDzYmBAsNDzY2mZmxYGgNzihhMwsxQjFMAzAYA",
    dps_no_pi: 1042728555e-2,
    dps_with_pi: 1083021491e-2,
    dps_delta: 402929.36,
    dps_pct_gain: 3.86,
    pi_dep_spell_ids: {
      "63560": 63560
    },
    gear: {
      head: {
        id: 237628,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raiddeathknightethereal_d_01.jpg"
      },
      neck: {
        id: 178827,
        bonus_ids: [
          "10039",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_7_0raid_necklace_03a.jpg"
      },
      shoulder: {
        id: 237626,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raiddeathknightethereal_d_01.jpg"
      },
      chest: {
        id: 237631,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raiddeathknightethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237627,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_plate_raiddeathknightethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 222437,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 242487,
        bonus_ids: [
          "10255",
          "10384",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "3368"
        ],
        icon: "data/icons/inv_sword_2h_outdoorethereal_c_01.jpg"
      },
      finger1: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 246344,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1602",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_qirajidol_onyx.jpg"
      }
    }
  },
  {
    class: "Monk",
    spec: "Windwalker",
    specId: 269,
    targets: 8,
    talents: "C0QAAAAAAAAAAAAAAAAAAAAAAMzgBzMjx2MzYmZAAAAAAAAAAAYZZYEzMMmhhFG2mZmhZjZGmlZCAglxMDwsNDAgNAoZZWamZmFYYG",
    dps_no_pi: 2172962325e-2,
    dps_with_pi: 2227187045e-2,
    dps_delta: 542247.2,
    dps_pct_gain: 2.5,
    pi_dep_spell_ids: {
      "388663": 388663
    },
    gear: {
      head: {
        id: 237673,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidmonkethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237671,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidmonkethereal_d_01.jpg"
      },
      chest: {
        id: 237676,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidmonkethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237672,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidmonkethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237674,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidmonkethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Monk",
    spec: "Windwalker",
    specId: 269,
    targets: 15,
    talents: "C0QAAAAAAAAAAAAAAAAAAAAAAMzgBzMjx2MzYmZAAAAAAAAAAAYZZYEzMMmhhFG2mZmhZjZGmlZCAglxMDwsNDAgNAoZZWamZmFYYG",
    dps_no_pi: 2971628806e-2,
    dps_with_pi: 3052829615e-2,
    dps_delta: 812008.09,
    dps_pct_gain: 2.73,
    pi_dep_spell_ids: {
      "388663": 388663
    },
    gear: {
      head: {
        id: 237673,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidmonkethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237671,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidmonkethereal_d_01.jpg"
      },
      chest: {
        id: 237676,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidmonkethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237672,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidmonkethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237674,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidmonkethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Monk",
    spec: "Windwalker",
    specId: 269,
    targets: 1,
    talents: "C0QAAAAAAAAAAAAAAAAAAAAAAMzsMAmZMLzMmZGAAAAAAAAAAAssMMiZGYGGWMzYbmZGmNmZwyMBAwyMzgZG2mBAwGA0sMLNzMzCgZA",
    dps_no_pi: 596749481e-2,
    dps_with_pi: 620288868e-2,
    dps_delta: 235393.87,
    dps_pct_gain: 3.94,
    pi_dep_spell_ids: {
      "388663": 388663
    },
    gear: {
      head: {
        id: 237673,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidmonkethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237671,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidmonkethereal_d_01.jpg"
      },
      chest: {
        id: 237676,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidmonkethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237672,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidmonkethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237674,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidmonkethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 221159,
        bonus_ids: [
          "10255",
          "10384",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_staff_2h_earthendungeon_c_02.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Monk",
    spec: "Windwalker",
    specId: 269,
    targets: 3,
    talents: "C0QAAAAAAAAAAAAAAAAAAAAAAMzgBzMjx2MzYmZAAAAAAAAAAAYZZYEzMMmhhFG2mZmhZjZGmlZCAglxMDwsNDAgNAoZZWamZmFYYG",
    dps_no_pi: 1143806857e-2,
    dps_with_pi: 1174202094e-2,
    dps_delta: 303952.37,
    dps_pct_gain: 2.66,
    pi_dep_spell_ids: {
      "388663": 388663
    },
    gear: {
      head: {
        id: 237673,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidmonkethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237671,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidmonkethereal_d_01.jpg"
      },
      chest: {
        id: 237676,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidmonkethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237672,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidmonkethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237674,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidmonkethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Monk",
    spec: "Windwalker",
    specId: 269,
    targets: 5,
    talents: "C0QAAAAAAAAAAAAAAAAAAAAAAMzgBzMjx2MzYmZAAAAAAAAAAAYZZYEzMMmhhFG2mZmhZjZGmlZCAglxMDwsNDAgNAoZZWamZmFYYG",
    dps_no_pi: 1757331383e-2,
    dps_with_pi: 1800981363e-2,
    dps_delta: 436499.8,
    dps_pct_gain: 2.48,
    pi_dep_spell_ids: {
      "388663": 388663
    },
    gear: {
      head: {
        id: 237673,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raidmonkethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237671,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidmonkethereal_d_01.jpg"
      },
      chest: {
        id: 237676,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raidmonkethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237672,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raidmonkethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237674,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raidmonkethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Shaman",
    spec: "Elemental",
    specId: 262,
    targets: 8,
    talents: "CYQAAAAAAAAAAAAAAAAAAAAAAAAAAAAMbz22MzMzY2mlxMgZmZAAAAAAbmxwGsAzohGbAgZZaGw2CjpBzMjhlZMjFzyMLzyMjBDzsNA",
    dps_no_pi: 3292903124e-2,
    dps_with_pi: 3393432332e-2,
    dps_delta: 100529208e-2,
    dps_pct_gain: 3.05,
    pi_dep_spell_ids: {
      "114050": 114050
    },
    gear: {
      head: {
        id: 237637,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidshamanethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213494",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237635,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidshamanethereal_d_01.jpg"
      },
      chest: {
        id: 237640,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidshamanethereal_d_01.jpg"
      },
      waist: {
        id: 219339,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237636,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_mail_raidshamanethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237638,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidshamanethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 237741,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shield_1h_etherealraid_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10844",
          "10879",
          "13446",
          "1540",
          "1782",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213482"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Shaman",
    spec: "Elemental",
    specId: 262,
    targets: 1,
    talents: "CYQAAAAAAAAAAAAAAAAAAAAAAAAAAAAMbzy2MjZGzysMGMYmBAAAAwiZWgBMgZjJkZBAMbTzA22YmphxMzyMWmZmxmxwsMmZMzYmZDA",
    dps_no_pi: 658200551e-2,
    dps_with_pi: 67567557e-1,
    dps_delta: 174750.19,
    dps_pct_gain: 2.65,
    pi_dep_spell_ids: {
      "114050": 114050
    },
    gear: {
      head: {
        id: 237637,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidshamanethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213473",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237635,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidshamanethereal_d_01.jpg"
      },
      chest: {
        id: 237640,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidshamanethereal_d_01.jpg"
      },
      waist: {
        id: 237554,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_mail_raidshamanethereal_d_01.jpg"
      },
      legs: {
        id: 237636,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_mail_raidshamanethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237638,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidshamanethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 237741,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shield_1h_etherealraid_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213497",
          "213497"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213497"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Shaman",
    spec: "Elemental",
    specId: 262,
    targets: 5,
    talents: "CYQAAAAAAAAAAAAAAAAAAAAAAAAAAAAMbz22MzMzY2mlxMgZmZAAAAAAbmxwGsAzohGbAgZZaGw2CjpBzMjhlZMjFzyMLzyMjBDzsNA",
    dps_no_pi: 2453013526e-2,
    dps_with_pi: 252430933e-1,
    dps_delta: 712958.04,
    dps_pct_gain: 2.91,
    pi_dep_spell_ids: {
      "114050": 114050
    },
    gear: {
      head: {
        id: 237637,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidshamanethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213494",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237635,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidshamanethereal_d_01.jpg"
      },
      chest: {
        id: 237640,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidshamanethereal_d_01.jpg"
      },
      waist: {
        id: 219339,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237636,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_mail_raidshamanethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237638,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidshamanethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 237741,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shield_1h_etherealraid_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10844",
          "10879",
          "13446",
          "1540",
          "1782",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213482"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Shaman",
    spec: "Elemental",
    specId: 262,
    targets: 3,
    talents: "CYQAAAAAAAAAAAAAAAAAAAAAAAAAAAAMbz22MzMzY2mlxMgZmZAAAAAAbmxwGsAzohGbAgZZaGw2CjpBzMjhlZMjFzyMLzyMjBDzsNA",
    dps_no_pi: 1138711045e-2,
    dps_with_pi: 1172337537e-2,
    dps_delta: 336264.92,
    dps_pct_gain: 2.95,
    pi_dep_spell_ids: {
      "114050": 114050
    },
    gear: {
      head: {
        id: 237637,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidshamanethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213494",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237635,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidshamanethereal_d_01.jpg"
      },
      chest: {
        id: 237640,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidshamanethereal_d_01.jpg"
      },
      waist: {
        id: 219339,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237636,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_mail_raidshamanethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237638,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidshamanethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 237741,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shield_1h_etherealraid_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10844",
          "10879",
          "13446",
          "1540",
          "1782",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213482"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Shaman",
    spec: "Elemental",
    specId: 262,
    targets: 15,
    talents: "CYQAAAAAAAAAAAAAAAAAAAAAAAAAAAAMbz22MzMzY2mlxMgZmZAAAAAAbmxwGsAzohGbAgZZaGw2CjpBzMjhlZMjFzyMLzyMjBDzsNA",
    dps_no_pi: 4740454818e-2,
    dps_with_pi: 4900734029e-2,
    dps_delta: 160279212e-2,
    dps_pct_gain: 3.38,
    pi_dep_spell_ids: {
      "114050": 114050
    },
    gear: {
      head: {
        id: 237637,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidshamanethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213494",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237635,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidshamanethereal_d_01.jpg"
      },
      chest: {
        id: 237640,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidshamanethereal_d_01.jpg"
      },
      waist: {
        id: 219339,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237636,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_mail_raidshamanethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237638,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidshamanethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 237741,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shield_1h_etherealraid_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10844",
          "10879",
          "13446",
          "1540",
          "1782",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213482"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Shaman",
    spec: "Enhancement",
    specId: 263,
    targets: 8,
    talents: "CcQAAAAAAAAAAAAAAAAAAAAAAMzMDMzDMjtZmZegZmlZGYAAAAAAAAAAWAsZGDbkFYGGawCAmtJDMLMjxYMmxMWmZmmFWmZZMzAAMGA",
    dps_no_pi: 2717545199e-2,
    dps_with_pi: 2797897555e-2,
    dps_delta: 803523.56,
    dps_pct_gain: 2.96,
    pi_dep_spell_ids: {
      "51533": 51533
    },
    gear: {
      head: {
        id: 237637,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidshamanethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237635,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidshamanethereal_d_01.jpg"
      },
      chest: {
        id: 237640,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidshamanethereal_d_01.jpg"
      },
      waist: {
        id: 245965,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213482"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237636,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidshamanethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237638,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidshamanethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 222451,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_axe_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 178824,
        bonus_ids: [
          "10013",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "12353",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_ring_revendrethraid_01_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 232541,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1566",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/ability_blackhand_attachedslagbombs.jpg"
      }
    }
  },
  {
    class: "Shaman",
    spec: "Enhancement",
    specId: 263,
    targets: 1,
    talents: "CcQAAAAAAAAAAAAAAAAAAAAAAMzMDmZGjtZmZGsNzYZYAAAAAAAAAAbA2MjhNyCMDDNYBAWmmZGssYmZmhxMz2wyMzEYYWmZAAGD",
    dps_no_pi: 576905581e-2,
    dps_with_pi: 611720052e-2,
    dps_delta: 348144.72,
    dps_pct_gain: 6.03,
    pi_dep_spell_ids: {
      "51533": 51533
    },
    gear: {
      head: {
        id: 237637,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidshamanethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213494",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237635,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidshamanethereal_d_01.jpg"
      },
      chest: {
        id: 237529,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidhunterethereal_d_01.jpg"
      },
      waist: {
        id: 237554,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_mail_raidshamanethereal_d_01.jpg"
      },
      legs: {
        id: 237636,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidshamanethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237638,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidshamanethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 178824,
        bonus_ids: [
          "10039",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_ring_revendrethraid_01_gold.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Shaman",
    spec: "Enhancement",
    specId: 263,
    targets: 5,
    talents: "CcQAAAAAAAAAAAAAAAAAAAAAAMzMDMzDMjtZmZegZmlZGYAAAAAAAAAAWAsZGDbkFYGGawCAmtJDMLMjxYMmxMWmZmmFWmZZMzAAMGA",
    dps_no_pi: 2025450301e-2,
    dps_with_pi: 2087500119e-2,
    dps_delta: 620498.17,
    dps_pct_gain: 3.06,
    pi_dep_spell_ids: {
      "51533": 51533
    },
    gear: {
      head: {
        id: 237637,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidshamanethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237635,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidshamanethereal_d_01.jpg"
      },
      chest: {
        id: 237640,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidshamanethereal_d_01.jpg"
      },
      waist: {
        id: 245965,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213482"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237636,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidshamanethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237638,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidshamanethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 222451,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_axe_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 178824,
        bonus_ids: [
          "10013",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "12353",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_ring_revendrethraid_01_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 232541,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1566",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/ability_blackhand_attachedslagbombs.jpg"
      }
    }
  },
  {
    class: "Shaman",
    spec: "Enhancement",
    specId: 263,
    targets: 15,
    talents: "CcQAAAAAAAAAAAAAAAAAAAAAAMzMDMzDMjtZmZegZmlZGYAAAAAAAAAAWAsZGDbkFYGGawCAmtJDMLMjxYMmxMWmZmmFWmZZMzAAMGA",
    dps_no_pi: 3727476561e-2,
    dps_with_pi: 3848785698e-2,
    dps_delta: 121309137e-2,
    dps_pct_gain: 3.25,
    pi_dep_spell_ids: {
      "51533": 51533
    },
    gear: {
      head: {
        id: 237637,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidshamanethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237635,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidshamanethereal_d_01.jpg"
      },
      chest: {
        id: 237640,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidshamanethereal_d_01.jpg"
      },
      waist: {
        id: 245965,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213482"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237636,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidshamanethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237638,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidshamanethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 222451,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_axe_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 178824,
        bonus_ids: [
          "10013",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "12353",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_ring_revendrethraid_01_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 232541,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1566",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/ability_blackhand_attachedslagbombs.jpg"
      }
    }
  },
  {
    class: "Shaman",
    spec: "Enhancement",
    specId: 263,
    targets: 3,
    talents: "CcQAAAAAAAAAAAAAAAAAAAAAAMzMDMzDMjtZmZegZmlZGYAAAAAAAAAAWAsZGDbkFYGGawCAmtJDMLMjxYMmxMWmZmmFWmZZMzAAMGA",
    dps_no_pi: 114333753e-1,
    dps_with_pi: 1182879109e-2,
    dps_delta: 395415.79,
    dps_pct_gain: 3.46,
    pi_dep_spell_ids: {
      "51533": 51533
    },
    gear: {
      head: {
        id: 237637,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidshamanethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237635,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidshamanethereal_d_01.jpg"
      },
      chest: {
        id: 237640,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidshamanethereal_d_01.jpg"
      },
      waist: {
        id: 245965,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213482"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237636,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_mail_raidshamanethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237638,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidshamanethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237738,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_hand_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 222451,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_axe_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 178824,
        bonus_ids: [
          "10013",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "12353",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_ring_revendrethraid_01_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 232541,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1566",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/ability_blackhand_attachedslagbombs.jpg"
      }
    }
  },
  {
    class: "Warrior",
    spec: "Fury",
    specId: 72,
    targets: 15,
    talents: "CgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQjhxsZmhZWGMzCzMzYGmhZ22mZMzMLAzMzYmxywwMzMAAAIGbbDsAmgZYCMYDA",
    dps_no_pi: 1183259231e-2,
    dps_with_pi: 1220875221e-2,
    dps_delta: 376159.9,
    dps_pct_gain: 3.18,
    pi_dep_spell_ids: {
      "107574": 107574
    },
    gear: {
      head: {
        id: 238028,
        bonus_ids: [
          "10255",
          "10356",
          "10844",
          "12239",
          "12365",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raidwarriorethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213470"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237608,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raidwarriorethereal_d_01.jpg"
      },
      chest: {
        id: 237613,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raidwarriorethereal_d_01.jpg"
      },
      waist: {
        id: 237550,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_plate_raidwarriorethereal_d_01.jpg"
      },
      legs: {
        id: 237609,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7595"
        ],
        icon: "data/icons/inv_pant_plate_raidwarriorethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8794",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237611,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_plate_raidwarriorethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213470"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 185813,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10389",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213497"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_jewelcrafting_80_maxlvlring_blue.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 246344,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1602",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_qirajidol_onyx.jpg"
      }
    }
  },
  {
    class: "Warrior",
    spec: "Fury",
    specId: 72,
    targets: 3,
    talents: "CgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQjhxsZmhZWGMzCzMzYGmhZ22mZMzMLAzMzYmxywwMzMAAAIGbbDsAmgZYCMYDA",
    dps_no_pi: 48838341e-1,
    dps_with_pi: 504624787e-2,
    dps_delta: 162413.77,
    dps_pct_gain: 3.33,
    pi_dep_spell_ids: {
      "107574": 107574
    },
    gear: {
      head: {
        id: 238028,
        bonus_ids: [
          "10255",
          "10356",
          "10844",
          "12239",
          "12365",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raidwarriorethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213470"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237608,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raidwarriorethereal_d_01.jpg"
      },
      chest: {
        id: 237613,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raidwarriorethereal_d_01.jpg"
      },
      waist: {
        id: 237550,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_plate_raidwarriorethereal_d_01.jpg"
      },
      legs: {
        id: 237609,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7595"
        ],
        icon: "data/icons/inv_pant_plate_raidwarriorethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8794",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237611,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_plate_raidwarriorethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213470"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 185813,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10389",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213497"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_jewelcrafting_80_maxlvlring_blue.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 246344,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1602",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_qirajidol_onyx.jpg"
      }
    }
  },
  {
    class: "Warrior",
    spec: "Fury",
    specId: 72,
    targets: 1,
    talents: "CgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQjhhNzMMzygZWYmZGzwMMz22MjZmZBYmZGzMWGGmZmBAAAxYbbgFwEMDTgZYDA",
    dps_no_pi: 247371085e-2,
    dps_with_pi: 256347949e-2,
    dps_delta: 89768.63,
    dps_pct_gain: 3.63,
    pi_dep_spell_ids: {
      "107574": 107574
    },
    gear: {
      head: {
        id: 237610,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raidwarriorethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237608,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raidwarriorethereal_d_01.jpg"
      },
      chest: {
        id: 237613,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raidwarriorethereal_d_01.jpg"
      },
      waist: {
        id: 237550,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_plate_raidwarriorethereal_d_01.jpg"
      },
      legs: {
        id: 237609,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7595"
        ],
        icon: "data/icons/inv_pant_plate_raidwarriorethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12922",
          "13468",
          "8792",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213473"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237611,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_plate_raidwarriorethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12259",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238042"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213470"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213473",
          "213473"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242394,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_obliterationcannon.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Warrior",
    spec: "Fury",
    specId: 72,
    targets: 5,
    talents: "CgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQjhxsZmhZWGMzCzMzYGmhZ22mZMzMLAzMzYmxywwMzMAAAIGbbDsAmgZYCMYDA",
    dps_no_pi: 753128123e-2,
    dps_with_pi: 777666398e-2,
    dps_delta: 245382.75,
    dps_pct_gain: 3.26,
    pi_dep_spell_ids: {
      "107574": 107574
    },
    gear: {
      head: {
        id: 238028,
        bonus_ids: [
          "10255",
          "10356",
          "10844",
          "12239",
          "12365",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raidwarriorethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213470"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237608,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raidwarriorethereal_d_01.jpg"
      },
      chest: {
        id: 237613,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raidwarriorethereal_d_01.jpg"
      },
      waist: {
        id: 237550,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_plate_raidwarriorethereal_d_01.jpg"
      },
      legs: {
        id: 237609,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7595"
        ],
        icon: "data/icons/inv_pant_plate_raidwarriorethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8794",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237611,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_plate_raidwarriorethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213470"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 185813,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10389",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213497"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_jewelcrafting_80_maxlvlring_blue.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 246344,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1602",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_qirajidol_onyx.jpg"
      }
    }
  },
  {
    class: "Warrior",
    spec: "Fury",
    specId: 72,
    targets: 8,
    talents: "CgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQjhxsZmhZWGMzCzMzYGmhZ22mZMzMLAzMzYmxywwMzMAAAIGbbDsAmgZYCMYDA",
    dps_no_pi: 946281292e-2,
    dps_with_pi: 976696351e-2,
    dps_delta: 304150.6,
    dps_pct_gain: 3.21,
    pi_dep_spell_ids: {
      "107574": 107574
    },
    gear: {
      head: {
        id: 238028,
        bonus_ids: [
          "10255",
          "10356",
          "10844",
          "12239",
          "12365",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raidwarriorethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213470"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237608,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raidwarriorethereal_d_01.jpg"
      },
      chest: {
        id: 237613,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raidwarriorethereal_d_01.jpg"
      },
      waist: {
        id: 237550,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_plate_raidwarriorethereal_d_01.jpg"
      },
      legs: {
        id: 237609,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7595"
        ],
        icon: "data/icons/inv_pant_plate_raidwarriorethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8794",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237611,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_plate_raidwarriorethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213470"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 185813,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10389",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213497"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_jewelcrafting_80_maxlvlring_blue.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 246344,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1602",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_qirajidol_onyx.jpg"
      }
    }
  },
  {
    class: "Warrior",
    spec: "Arms",
    specId: 71,
    targets: 5,
    talents: "CcEAAAAAAAAAAAAAAAAAAAAAAghZmxMmxMz2stsMmBAAAYw0wYWGzwYZMzM2MzMmZwwAAAAAAAwMmtBDYLGwmZMsBDMj2oBsAA",
    dps_no_pi: 1537392231e-2,
    dps_with_pi: 1582214398e-2,
    dps_delta: 448221.66,
    dps_pct_gain: 2.92,
    pi_dep_spell_ids: {
      "107574": 107574
    },
    gear: {
      head: {
        id: 237610,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12361",
          "12676",
          "12921",
          "1533",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raidwarriorethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10395",
          "10421",
          "10879",
          "11941",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213455",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237608,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raidwarriorethereal_d_01.jpg"
      },
      chest: {
        id: 237613,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raidwarriorethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237609,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7595"
        ],
        icon: "data/icons/inv_pant_plate_raidwarriorethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237611,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_plate_raidwarriorethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 242487,
        bonus_ids: [
          "10255",
          "10384",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_sword_2h_outdoorethereal_c_01.jpg"
      },
      finger1: {
        id: 246281,
        bonus_ids: [
          "10016",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "12353",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213455"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "12361",
          "1533",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 246344,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1602",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_qirajidol_onyx.jpg"
      }
    }
  },
  {
    class: "Warrior",
    spec: "Arms",
    specId: 71,
    targets: 3,
    talents: "CcEAAAAAAAAAAAAAAAAAAAAAAghZmxMmxMz2stsMmBAAAYw0wYWGzwYZMzM2MzMmZwwAAAAAAAwMmtBDYLGwmZMsBDMj2oBsAA",
    dps_no_pi: 1081635564e-2,
    dps_with_pi: 1112196193e-2,
    dps_delta: 305606.3,
    dps_pct_gain: 2.83,
    pi_dep_spell_ids: {
      "107574": 107574
    },
    gear: {
      head: {
        id: 237610,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12361",
          "12676",
          "12921",
          "1533",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raidwarriorethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10395",
          "10421",
          "10879",
          "11941",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213455",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237608,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raidwarriorethereal_d_01.jpg"
      },
      chest: {
        id: 237613,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raidwarriorethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237609,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7595"
        ],
        icon: "data/icons/inv_pant_plate_raidwarriorethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237611,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_plate_raidwarriorethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 242487,
        bonus_ids: [
          "10255",
          "10384",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_sword_2h_outdoorethereal_c_01.jpg"
      },
      finger1: {
        id: 246281,
        bonus_ids: [
          "10016",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "12353",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213455"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "12361",
          "1533",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 246344,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1602",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_qirajidol_onyx.jpg"
      }
    }
  },
  {
    class: "Warrior",
    spec: "Arms",
    specId: 71,
    targets: 15,
    talents: "CcEAAAAAAAAAAAAAAAAAAAAAAghZmxMmxMz2stsMmBAAAYw0wYWGzwYZMzM2MzMmZwwAAAAAAAwMmtBDYLGwmZMsBDMj2oBsAA",
    dps_no_pi: 2694005528e-2,
    dps_with_pi: 2776648812e-2,
    dps_delta: 826432.83,
    dps_pct_gain: 3.07,
    pi_dep_spell_ids: {
      "107574": 107574
    },
    gear: {
      head: {
        id: 237610,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12361",
          "12676",
          "12921",
          "1533",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raidwarriorethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10395",
          "10421",
          "10879",
          "11941",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213455",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237608,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raidwarriorethereal_d_01.jpg"
      },
      chest: {
        id: 237613,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raidwarriorethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237609,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7595"
        ],
        icon: "data/icons/inv_pant_plate_raidwarriorethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237611,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_plate_raidwarriorethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 242487,
        bonus_ids: [
          "10255",
          "10384",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_sword_2h_outdoorethereal_c_01.jpg"
      },
      finger1: {
        id: 246281,
        bonus_ids: [
          "10016",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "12353",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213455"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "12361",
          "1533",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 246344,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1602",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_qirajidol_onyx.jpg"
      }
    }
  },
  {
    class: "Warrior",
    spec: "Arms",
    specId: 71,
    targets: 8,
    talents: "CcEAAAAAAAAAAAAAAAAAAAAAAghZmxMmxMz2stsMmBAAAYw0wYWGzwYZMzM2MzMmZwwAAAAAAAwMmtBDYLGwmZMsBDMj2oBsAA",
    dps_no_pi: 1970476038e-2,
    dps_with_pi: 2027722698e-2,
    dps_delta: 572466.59,
    dps_pct_gain: 2.91,
    pi_dep_spell_ids: {
      "107574": 107574
    },
    gear: {
      head: {
        id: 237610,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12361",
          "12676",
          "12921",
          "1533",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raidwarriorethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10395",
          "10421",
          "10879",
          "11941",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213455",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237608,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raidwarriorethereal_d_01.jpg"
      },
      chest: {
        id: 237613,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raidwarriorethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237609,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7595"
        ],
        icon: "data/icons/inv_pant_plate_raidwarriorethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237611,
        bonus_ids: [
          "10255",
          "10390",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_plate_raidwarriorethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 242487,
        bonus_ids: [
          "10255",
          "10384",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_sword_2h_outdoorethereal_c_01.jpg"
      },
      finger1: {
        id: 246281,
        bonus_ids: [
          "10016",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "12353",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213455"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "12361",
          "1533",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 246344,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "1602",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_qirajidol_onyx.jpg"
      }
    }
  },
  {
    class: "Warrior",
    spec: "Arms",
    specId: 71,
    targets: 1,
    talents: "CcEAAAAAAAAAAAAAAAAAAAAAAAMjZmxMmZ2mlllZGAAAADmGmZWMzwMGMjNzMDzwMMAAAAAAA8AjZZmZGgwYbbgFwAmhJkB2A",
    dps_no_pi: 497031745e-2,
    dps_with_pi: 515277744e-2,
    dps_delta: 182460,
    dps_pct_gain: 3.67,
    pi_dep_spell_ids: {
      "107574": 107574
    },
    gear: {
      head: {
        id: 237610,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_plate_raidwarriorethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237608,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_plate_raidwarriorethereal_d_01.jpg"
      },
      chest: {
        id: 237613,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_plate_raidwarriorethereal_d_01.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237609,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7595"
        ],
        icon: "data/icons/inv_pant_plate_raidwarriorethereal_d_01.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7418"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237611,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_plate_raidwarriorethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237813,
        bonus_ids: [
          "10255",
          "10356",
          "12356",
          "1517",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_mace_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 242493,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "12352",
          "3193",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shield_1h_outdoorethereal_c_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 221136,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_11_0_nerubian_ring_01_color4.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242394,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_obliterationcannon.jpg"
      }
    }
  },
  {
    class: "Druid",
    spec: "Feral",
    specId: 103,
    targets: 8,
    talents: "CcGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMbzmZWYmZmZzmZsMzMzYmBAAAAAYLY2MwMjaGzCLzMzyYGzAAAAAAADAAAAQzsMLzMbDIwCMzAwCDG",
    dps_no_pi: 2423014065e-2,
    dps_with_pi: 2500868592e-2,
    dps_delta: 778545.28,
    dps_pct_gain: 3.21,
    pi_dep_spell_ids: {
      "106951": 106951
    },
    gear: {
      head: {
        id: 237682,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddruidethereal_d_01.jpg"
      },
      neck: {
        id: 178827,
        bonus_ids: [
          "10039",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_7_0raid_necklace_03a.jpg"
      },
      shoulder: {
        id: 237680,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddruidethereal_d_01.jpg"
      },
      chest: {
        id: 237685,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddruidethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237681,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raiddruidethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237683,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddruidethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237739,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_polearm_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10844",
          "10879",
          "13446",
          "1540",
          "1777",
          "6652"
        ],
        gem_ids: [
          "213473",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213455"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Druid",
    spec: "Feral",
    specId: 103,
    targets: 1,
    talents: "CcGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmBmZZmZMzsNbjx2MmxMzAAAAAAsFMbwYmRNjZhlZmxYGzAAAAAAADMAAAACAmtZWaWmZZDMDALmBD",
    dps_no_pi: 621648188e-2,
    dps_with_pi: 655860211e-2,
    dps_delta: 342120.23,
    dps_pct_gain: 5.5,
    pi_dep_spell_ids: {
      "106951": 106951
    },
    gear: {
      head: {
        id: 237682,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddruidethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237680,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddruidethereal_d_01.jpg"
      },
      chest: {
        id: 237685,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddruidethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237681,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raiddruidethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237683,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddruidethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237739,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_polearm_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Druid",
    spec: "Feral",
    specId: 103,
    targets: 3,
    talents: "CcGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMbzmZWYmZmZzmZsMzMzYmBAAAAAYLY2MwMjaGzCLzMzyYGzAAAAAAADAAAAQzsMLzMbDIwCMzAwCDG",
    dps_no_pi: 1162332988e-2,
    dps_with_pi: 1207368653e-2,
    dps_delta: 450356.64,
    dps_pct_gain: 3.87,
    pi_dep_spell_ids: {
      "106951": 106951
    },
    gear: {
      head: {
        id: 237682,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddruidethereal_d_01.jpg"
      },
      neck: {
        id: 178827,
        bonus_ids: [
          "10039",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_7_0raid_necklace_03a.jpg"
      },
      shoulder: {
        id: 237680,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddruidethereal_d_01.jpg"
      },
      chest: {
        id: 237685,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddruidethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237681,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raiddruidethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237683,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddruidethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237739,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_polearm_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10844",
          "10879",
          "13446",
          "1540",
          "1777",
          "6652"
        ],
        gem_ids: [
          "213473",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213455"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Druid",
    spec: "Feral",
    specId: 103,
    targets: 15,
    talents: "CcGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMbzmZWYmZmZzmZsMzMzYmBAAAAAYLY2MwMjaGzCLzMzyYGzAAAAAAADAAAAQzsMLzMbDIwCMzAwCDG",
    dps_no_pi: 3796952764e-2,
    dps_with_pi: 3907569838e-2,
    dps_delta: 110617074e-2,
    dps_pct_gain: 2.91,
    pi_dep_spell_ids: {
      "106951": 106951
    },
    gear: {
      head: {
        id: 237682,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddruidethereal_d_01.jpg"
      },
      neck: {
        id: 178827,
        bonus_ids: [
          "10039",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_7_0raid_necklace_03a.jpg"
      },
      shoulder: {
        id: 237680,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddruidethereal_d_01.jpg"
      },
      chest: {
        id: 237685,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddruidethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237681,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raiddruidethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237683,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddruidethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237739,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_polearm_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10844",
          "10879",
          "13446",
          "1540",
          "1777",
          "6652"
        ],
        gem_ids: [
          "213473",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213455"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Druid",
    spec: "Feral",
    specId: 103,
    targets: 5,
    talents: "CcGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMbzmZWYmZmZzmZsMzMzYmBAAAAAYLY2MwMjaGzCLzMzyYGzAAAAAAADAAAAQzsMLzMbDIwCMzAwCDG",
    dps_no_pi: 1762840473e-2,
    dps_with_pi: 1825162131e-2,
    dps_delta: 623216.58,
    dps_pct_gain: 3.54,
    pi_dep_spell_ids: {
      "106951": 106951
    },
    gear: {
      head: {
        id: 237682,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddruidethereal_d_01.jpg"
      },
      neck: {
        id: 178827,
        bonus_ids: [
          "10039",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_7_0raid_necklace_03a.jpg"
      },
      shoulder: {
        id: 237680,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddruidethereal_d_01.jpg"
      },
      chest: {
        id: 237685,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddruidethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237681,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raiddruidethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237683,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddruidethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237739,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_polearm_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 238036,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10844",
          "10879",
          "13446",
          "1540",
          "1777",
          "6652"
        ],
        gem_ids: [
          "213473",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_dark.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213455"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Druid",
    spec: "Balance",
    specId: 102,
    targets: 15,
    talents: "CYGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALUmtmxYmBYWYZmZWYYsYWmZZmZbmZmZmZxsMGGshFGgxy2MbYMbjATAAAAWMzYA2MMG",
    dps_no_pi: 4316287783e-2,
    dps_with_pi: 4387455137e-2,
    dps_delta: 711673.55,
    dps_pct_gain: 1.65,
    pi_dep_spell_ids: {
      "102560": 102560,
      "194223": 194223
    },
    gear: {
      head: {
        id: 237682,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddruidethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237680,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddruidethereal_d_01.jpg"
      },
      chest: {
        id: 237685,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddruidethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237681,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_leather_raiddruidethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237683,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddruidethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 242491,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "3222",
          "41"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring01_etherealnontechnologicalstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Druid",
    spec: "Balance",
    specId: 102,
    targets: 5,
    talents: "CYGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALUmtmxYmBYWYZmZWYYsYWmZZmZbmZmZmZxsMGGshFGgxy2MbYMbjATAAAAWMzYA2MMG",
    dps_no_pi: 1940193123e-2,
    dps_with_pi: 1979958468e-2,
    dps_delta: 397653.45,
    dps_pct_gain: 2.05,
    pi_dep_spell_ids: {
      "102560": 102560,
      "194223": 194223
    },
    gear: {
      head: {
        id: 237682,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddruidethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237680,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddruidethereal_d_01.jpg"
      },
      chest: {
        id: 237685,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddruidethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237681,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_leather_raiddruidethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237683,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddruidethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 242491,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "3222",
          "41"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring01_etherealnontechnologicalstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Druid",
    spec: "Balance",
    specId: 102,
    targets: 3,
    talents: "CYGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALUmtmxYmBYWYZmZWYYsYWmZZmZbmZmZmZxsMGGshFGgxy2MbYMbjATAAAAWMzYA2MMG",
    dps_no_pi: 1261523413e-2,
    dps_with_pi: 1290586558e-2,
    dps_delta: 290631.45,
    dps_pct_gain: 2.3,
    pi_dep_spell_ids: {
      "102560": 102560,
      "194223": 194223
    },
    gear: {
      head: {
        id: 237682,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddruidethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237680,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddruidethereal_d_01.jpg"
      },
      chest: {
        id: 237685,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddruidethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237681,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_leather_raiddruidethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237683,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddruidethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 242491,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "3222",
          "41"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring01_etherealnontechnologicalstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Druid",
    spec: "Balance",
    specId: 102,
    targets: 1,
    talents: "CYGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALUmtMGzMwDYWGLzMDwMGLzsNjlxMjZmFjZGzMjNswAMAbbjNMNzsMCAAAwGzMjB2MGG",
    dps_no_pi: 640643659e-2,
    dps_with_pi: 659204822e-2,
    dps_delta: 185611.63,
    dps_pct_gain: 2.9,
    pi_dep_spell_ids: {
      "102560": 102560,
      "194223": 194223
    },
    gear: {
      head: {
        id: 237682,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddruidethereal_d_01.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "11941",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213482",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237552,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raidrogueethereal_d_01.jpg"
      },
      chest: {
        id: 237685,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddruidethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237681,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_leather_raiddruidethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237683,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddruidethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8794",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213497"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Druid",
    spec: "Balance",
    specId: 102,
    targets: 8,
    talents: "CYGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALUmtmxYmBYWYZmZWYYsYWmZZmZbmZmZmZxsMGGshFGgxy2MbYMbjATAAAAWMzYA2MMG",
    dps_no_pi: 2810543352e-2,
    dps_with_pi: 2864501455e-2,
    dps_delta: 539581.03,
    dps_pct_gain: 1.92,
    pi_dep_spell_ids: {
      "102560": 102560,
      "194223": 194223
    },
    gear: {
      head: {
        id: 237682,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddruidethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213497",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237680,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddruidethereal_d_01.jpg"
      },
      chest: {
        id: 237685,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddruidethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237681,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_leather_raiddruidethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237683,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddruidethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 242491,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "3222",
          "41"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring01_etherealnontechnologicalstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Demonology",
    specId: 266,
    targets: 15,
    talents: "CoQAAAAAAAAAAAAAAAAAAAAAAAmZmZmZMMbGGzmZmhZbAAAAAAAAAAMDYMjhFYglRL0wCzMmx2YmtZMzMjxMGmZmZmBmBAAA",
    dps_no_pi: 4374772249e-2,
    dps_with_pi: 4489663247e-2,
    dps_delta: 114890998e-2,
    dps_pct_gain: 2.63,
    pi_dep_spell_ids: {
      "456323": 456323
    },
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 178822,
        bonus_ids: [
          "10039",
          "10255",
          "10383",
          "10390",
          "12239",
          "12921",
          "13446",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_cloth_oribosdungeon_c_01.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Demonology",
    specId: 266,
    targets: 8,
    talents: "CoQAAAAAAAAAAAAAAAAAAAAAAAmZmZmZMMbGGzmZmhZbAAAAAAAAAAMDYMjhFYglRL0wCzMmx2YmtZMzMjxMGmZmZmBmBAAA",
    dps_no_pi: 2689058594e-2,
    dps_with_pi: 2759769303e-2,
    dps_delta: 707107.08,
    dps_pct_gain: 2.63,
    pi_dep_spell_ids: {
      "456323": 456323
    },
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 178822,
        bonus_ids: [
          "10039",
          "10255",
          "10383",
          "10390",
          "12239",
          "12921",
          "13446",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_cloth_oribosdungeon_c_01.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Demonology",
    specId: 266,
    targets: 1,
    talents: "CoQAAAAAAAAAAAAAAAAAAAAAAAmZmZmZMMbGY2mZmhZbAAAAAAAAAAMDYMjhFYglRL0wCzYG2mZmlZMzMjxMGmZGjhZmBAAA",
    dps_no_pi: 647263396e-2,
    dps_with_pi: 672184352e-2,
    dps_delta: 249209.56,
    dps_pct_gain: 3.85,
    pi_dep_spell_ids: {
      "456323": 456323
    },
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213461"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 237538,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_cloth_raidwarlockethereal_d_01.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8795",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213455",
          "213455"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      trinket1: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Demonology",
    specId: 266,
    targets: 3,
    talents: "CoQAAAAAAAAAAAAAAAAAAAAAAAmZmZmZMMbGGzmZmhZbAAAAAAAAAAMDYMjhFYglRL0wCzMmx2YmtZMzMjxMGmZmZmBmBAAA",
    dps_no_pi: 1202625177e-2,
    dps_with_pi: 1236825584e-2,
    dps_delta: 342004.08,
    dps_pct_gain: 2.84,
    pi_dep_spell_ids: {
      "456323": 456323
    },
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 178822,
        bonus_ids: [
          "10039",
          "10255",
          "10383",
          "10390",
          "12239",
          "12921",
          "13446",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_cloth_oribosdungeon_c_01.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Demonology",
    specId: 266,
    targets: 5,
    talents: "CoQAAAAAAAAAAAAAAAAAAAAAAAmZmZmZMMbGGzmZmhZbAAAAAAAAAAMDYMjhFYglRL0wCzMmx2YmtZMzMjxMGmZmZmBmBAAA",
    dps_no_pi: 1839006961e-2,
    dps_with_pi: 1889662028e-2,
    dps_delta: 506550.67,
    dps_pct_gain: 2.75,
    pi_dep_spell_ids: {
      "456323": 456323
    },
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 178822,
        bonus_ids: [
          "10039",
          "10255",
          "10383",
          "10390",
          "12239",
          "12921",
          "13446",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_cloth_oribosdungeon_c_01.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11304",
          "12050",
          "12053",
          "12921",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Affliction",
    specId: 265,
    targets: 3,
    talents: "CkQAAAAAAAAAAAAAAAAAAAAAAAzMzMzMjhZzwY2MzMMLDAAAYmxMLzMGLzMzsYGzMAgZsADMLGNmBkZDsMDAAAAAAAAmhFA",
    dps_no_pi: 1078754887e-2,
    dps_with_pi: 1140949724e-2,
    dps_delta: 621948.37,
    dps_pct_gain: 5.77,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 242664,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213461"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213461"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Affliction",
    specId: 265,
    targets: 5,
    talents: "CkQAAAAAAAAAAAAAAAAAAAAAAAzMzMzMjhZzwY2MzMMLDAAAYmxMLzMGLzMzsYGzMAgZsADMLGNmBkZDsMDAAAAAAAAmhFA",
    dps_no_pi: 1735547369e-2,
    dps_with_pi: 1844094922e-2,
    dps_delta: 108547554e-2,
    dps_pct_gain: 6.25,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 242664,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213461"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213461"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Affliction",
    specId: 265,
    targets: 8,
    talents: "CkQAAAAAAAAAAAAAAAAAAAAAAAzMzMzMjhZzwY2MzMMLDAAAYmxMLzMGLzMzsYGzMAgZsADMLGNmBkZDsMDAAAAAAAAmhFA",
    dps_no_pi: 2533299143e-2,
    dps_with_pi: 2719096384e-2,
    dps_delta: 185797241e-2,
    dps_pct_gain: 7.33,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 242664,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213461"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213461"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Affliction",
    specId: 265,
    targets: 1,
    talents: "CkQAAAAAAAAAAAAAAAAAAAAAAAzMzMzMjhZzAz2MzMMbDAAAYmxMLmZGLzMzsYYmBAMjFYgZxoxMgMLglZAAAAAAAAwMmNA",
    dps_no_pi: 593741772e-2,
    dps_with_pi: 627596053e-2,
    dps_delta: 338542.81,
    dps_pct_gain: 5.7,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 237538,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_cloth_raidwarlockethereal_d_01.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213482",
          "213482"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Affliction",
    specId: 265,
    targets: 15,
    talents: "CkQAAAAAAAAAAAAAAAAAAAAAAAzMzMzMjhZzwY2MzMMLDAAAYmxMLzMGLzMzsYGzMAgZsADMLGNmBkZDsMDAAAAAAAAmhFA",
    dps_no_pi: 3932574011e-2,
    dps_with_pi: 4243162578e-2,
    dps_delta: 310588566e-2,
    dps_pct_gain: 7.9,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 242664,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10355",
          "12239",
          "13444",
          "13503",
          "1527",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12921",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213461"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213461"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Destruction",
    specId: 267,
    targets: 15,
    talents: "CsQAAAAAAAAAAAAAAAAAAAAAAMMmxMzMjhZzwY2MzMMLzmxYGziZYZZmZAAAAAjZ2WmZWmHwCMwsY0YGAzWshBAAAAAAwMzMGAA",
    dps_no_pi: 3766656352e-2,
    dps_with_pi: 4124948023e-2,
    dps_delta: 358291671e-2,
    dps_pct_gain: 9.51,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213746"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 237724,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_etherealraid_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213491"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Destruction",
    specId: 267,
    targets: 5,
    talents: "CsQAAAAAAAAAAAAAAAAAAAAAAMMmxMzMjhZzwY2MzMMLzmxYGziZYZZmZAAAAAjZ2WmZWmHwCMwsY0YGAzWshBAAAAAAwMzMGAA",
    dps_no_pi: 1441843974e-2,
    dps_with_pi: 1485731767e-2,
    dps_delta: 438877.92,
    dps_pct_gain: 3.04,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213746"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 237724,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_etherealraid_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213491"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Destruction",
    specId: 267,
    targets: 8,
    talents: "CsQAAAAAAAAAAAAAAAAAAAAAAMMmxMzMjhZzwY2MzMMLzmxYGziZYZZmZAAAAAjZ2WmZWmHwCMwsY0YGAzWshBAAAAAAwMzMGAA",
    dps_no_pi: 221033264e-1,
    dps_with_pi: 2348505179e-2,
    dps_delta: 138172539e-2,
    dps_pct_gain: 6.25,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213746"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 237724,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_etherealraid_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213491"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Destruction",
    specId: 267,
    targets: 3,
    talents: "CsQAAAAAAAAAAAAAAAAAAAAAAMMmxMzMjhZzwY2MzMMLzmxYGziZYZZmZAAAAAjZ2WmZWmHwCMwsY0YGAzWshBAAAAAAwMzMGAA",
    dps_no_pi: 1074602564e-2,
    dps_with_pi: 1118302578e-2,
    dps_delta: 437000.14,
    dps_pct_gain: 4.07,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213746"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 237724,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_etherealraid_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213491"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Warlock",
    spec: "Destruction",
    specId: 267,
    targets: 1,
    talents: "CsQAAAAAAAAAAAAAAAAAAAAAAAmZmZmZMMbGY2mZmhZZWMMzMzyMjZbxMDAAAAMzMsMzsMDYMjhFyAbDL0YBDAAAAAAghxMAA",
    dps_no_pi: 63859761e-1,
    dps_with_pi: 656621463e-2,
    dps_delta: 180238.53,
    dps_pct_gain: 2.82,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237700,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidwarlockethereal_d_01.jpg"
      },
      neck: {
        id: 242406,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace02_etherealribbonorrunestyle_gold.jpg"
      },
      shoulder: {
        id: 237698,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidwarlockethereal_d_01.jpg"
      },
      chest: {
        id: 237703,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidwarlockethereal_d_01.jpg"
      },
      waist: {
        id: 237538,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_cloth_raidwarlockethereal_d_01.jpg"
      },
      legs: {
        id: 237699,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidwarlockethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213497"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237701,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidwarlockethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7448"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      },
      trinket2: {
        id: 242497,
        bonus_ids: [
          "10255",
          "10383",
          "10390",
          "13446",
          "3222",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_devourersmallmount_light.jpg"
      }
    }
  },
  {
    class: "Priest",
    spec: "Shadow",
    specId: 258,
    targets: 1,
    talents: "CIQAAAAAAAAAAAAAAAAAAAAAAMMMGAAAAAAAAAAAAjxygZmZbZjZmZmZmZZwsxMzMjZjBGjhZxsN1MDWwMAzsZZ0sZAIjxCAsNA",
    dps_no_pi: 609174471e-2,
    dps_with_pi: 626892534e-2,
    dps_delta: 177180.63,
    dps_pct_gain: 2.91,
    pi_dep_spell_ids: {
      "228260": 228260
    },
    gear: {
      head: {
        id: 237709,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidpriestethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237707,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidpriestethereal_d_01.jpg"
      },
      chest: {
        id: 237712,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidpriestethereal_d_01.jpg"
      },
      waist: {
        id: 237706,
        bonus_ids: [
          "10255",
          "10356",
          "12365",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213494"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_belt_cloth_raidpriestethereal_d_01.jpg"
      },
      legs: {
        id: 237708,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidpriestethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7418"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12922",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237710,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidpriestethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Priest",
    spec: "Shadow",
    specId: 258,
    targets: 5,
    talents: "CIQAAAAAAAAAAAAAAAAAAAAAAMMMAAAAAAAAAAAAYMWGjZmZbZjZmZmZmZZwsxMzMjZjBGjhZxsN1MDWwMAzsZZ0sZAIjxCAsNDA",
    dps_no_pi: 1620421302e-2,
    dps_with_pi: 1672587983e-2,
    dps_delta: 521666.81,
    dps_pct_gain: 3.22,
    pi_dep_spell_ids: {
      "228260": 228260
    },
    gear: {
      head: {
        id: 237709,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidpriestethereal_d_01.jpg"
      },
      neck: {
        id: 185842,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_misc_silverjadenecklace.jpg"
      },
      shoulder: {
        id: 237707,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidpriestethereal_d_01.jpg"
      },
      chest: {
        id: 237712,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidpriestethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237708,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidpriestethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237710,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidpriestethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10394",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213473",
          "213482"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213746"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Priest",
    spec: "Shadow",
    specId: 258,
    targets: 15,
    talents: "CIQAAAAAAAAAAAAAAAAAAAAAAMMMAAAAAAAAAAAAYMWGjZmZbZjZmZmZmZZwsxMzMjZjBGjhZxsN1MDWwMAzsZZ0sZAIjxCAsNDA",
    dps_no_pi: 3714741556e-2,
    dps_with_pi: 387356025e-1,
    dps_delta: 158818695e-2,
    dps_pct_gain: 4.28,
    pi_dep_spell_ids: {
      "228260": 228260
    },
    gear: {
      head: {
        id: 237709,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidpriestethereal_d_01.jpg"
      },
      neck: {
        id: 185842,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_misc_silverjadenecklace.jpg"
      },
      shoulder: {
        id: 237707,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidpriestethereal_d_01.jpg"
      },
      chest: {
        id: 237712,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidpriestethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237708,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidpriestethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237710,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidpriestethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10394",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213473",
          "213482"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213746"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Priest",
    spec: "Shadow",
    specId: 258,
    targets: 3,
    talents: "CIQAAAAAAAAAAAAAAAAAAAAAAMMMAAAAAAAAAAAAYMWGjZmZbZjZmZmZmZZwsxMzMjZjBGjhZxsN1MDWwMAzsZZ0sZAIjxCAsNDA",
    dps_no_pi: 1090948196e-2,
    dps_with_pi: 112634581e-1,
    dps_delta: 353976.13,
    dps_pct_gain: 3.24,
    pi_dep_spell_ids: {
      "228260": 228260
    },
    gear: {
      head: {
        id: 237709,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidpriestethereal_d_01.jpg"
      },
      neck: {
        id: 185842,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_misc_silverjadenecklace.jpg"
      },
      shoulder: {
        id: 237707,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidpriestethereal_d_01.jpg"
      },
      chest: {
        id: 237712,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidpriestethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237708,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidpriestethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237710,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidpriestethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10394",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213473",
          "213482"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213746"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Priest",
    spec: "Shadow",
    specId: 258,
    targets: 8,
    talents: "CIQAAAAAAAAAAAAAAAAAAAAAAMMMAAAAAAAAAAAAYMWGjZmZbZjZmZmZmZZwsxMzMjZjBGjhZxsN1MDWwMAzsZZ0sZAIjxCAsNDA",
    dps_no_pi: 2326738932e-2,
    dps_with_pi: 2402995007e-2,
    dps_delta: 762560.75,
    dps_pct_gain: 3.28,
    pi_dep_spell_ids: {
      "228260": 228260
    },
    gear: {
      head: {
        id: 237709,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_cloth_raidpriestethereal_d_01.jpg"
      },
      neck: {
        id: 185842,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_misc_silverjadenecklace.jpg"
      },
      shoulder: {
        id: 237707,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_cloth_raidpriestethereal_d_01.jpg"
      },
      chest: {
        id: 237712,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_robe_cloth_raidpriestethereal_d_01.jpg"
      },
      waist: {
        id: 222816,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237708,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_cloth_raidpriestethereal_d_01.jpg"
      },
      feet: {
        id: 243305,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_cloth_raidpriestethereal_d_01.jpg"
      },
      wrist: {
        id: 222815,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_cloth_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237710,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_cloth_raidpriestethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10394",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8793",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213473",
          "213482"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213746"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "DemonHunter",
    spec: "Havoc",
    specId: 577,
    targets: 5,
    talents: "CEkAAAAAAAAAAAAAAAAAAAAAAYmZmZmZmZMzMjhJDzAAAAAAAmFjxMjZmZbMzGWmZwYYssNbzghx2GTyMmZGGWA",
    dps_no_pi: 1494434089e-2,
    dps_with_pi: 153742709e-1,
    dps_delta: 429930.01,
    dps_pct_gain: 2.88,
    pi_dep_spell_ids: {
      "162264": 162264
    },
    gear: {
      head: {
        id: 237691,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddemonhunterethereal_d_01.jpg"
      },
      neck: {
        id: 242406,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace02_etherealribbonorrunestyle_gold.jpg"
      },
      shoulder: {
        id: 237689,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddemonhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237694,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "40"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddemonhunterethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237690,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raiddemonhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237692,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddemonhunterethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237727,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_glaive_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237727,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_glaive_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "DemonHunter",
    spec: "Havoc",
    specId: 577,
    targets: 3,
    talents: "CEkAAAAAAAAAAAAAAAAAAAAAAYmZmZmZmZMzMjhJDzAAAAAAAmFjxMjZmZbMzGWmZwYYssNbzghx2GTyMmZGGWA",
    dps_no_pi: 1075912978e-2,
    dps_with_pi: 1106771747e-2,
    dps_delta: 308587.69,
    dps_pct_gain: 2.87,
    pi_dep_spell_ids: {
      "162264": 162264
    },
    gear: {
      head: {
        id: 237691,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddemonhunterethereal_d_01.jpg"
      },
      neck: {
        id: 242406,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace02_etherealribbonorrunestyle_gold.jpg"
      },
      shoulder: {
        id: 237689,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddemonhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237694,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "40"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddemonhunterethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237690,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raiddemonhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237692,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddemonhunterethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237727,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_glaive_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237727,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_glaive_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "DemonHunter",
    spec: "Havoc",
    specId: 577,
    targets: 1,
    talents: "CEkAAAAAAAAAAAAAAAAAAAAAAYmZGzMzgZmZMmJmZGAAAAAAwsMmxMMGLjZ2wyMmxMjhlNYZ2MjhZTTjxMzMD2A",
    dps_no_pi: 586259685e-2,
    dps_with_pi: 601552188e-2,
    dps_delta: 152925.03,
    dps_pct_gain: 2.61,
    pi_dep_spell_ids: {
      "162264": 162264
    },
    gear: {
      head: {
        id: 237691,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddemonhunterethereal_d_01.jpg"
      },
      neck: {
        id: 242406,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace02_etherealribbonorrunestyle_gold.jpg"
      },
      shoulder: {
        id: 237689,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddemonhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237694,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddemonhunterethereal_d_01.jpg"
      },
      waist: {
        id: 237533,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_leather_raidmonkethereal_d_01.jpg"
      },
      legs: {
        id: 237690,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raiddemonhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237692,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddemonhunterethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 222441,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_glaive_1h_arathoroutdoor_d_01.jpg"
      },
      off_hand: {
        id: 237727,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_glaive_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 242405,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring02_etherealribbonorrunestyle_gold.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242397,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_agidpsancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "DemonHunter",
    spec: "Havoc",
    specId: 577,
    targets: 8,
    talents: "CEkAAAAAAAAAAAAAAAAAAAAAAYmZmZmZmZMzMjhJDzAAAAAAAmFjxMjZmZbMzGWmZwYYssNbzghx2GTyMmZGGWA",
    dps_no_pi: 1956685484e-2,
    dps_with_pi: 2011132982e-2,
    dps_delta: 544474.98,
    dps_pct_gain: 2.78,
    pi_dep_spell_ids: {
      "162264": 162264
    },
    gear: {
      head: {
        id: 237691,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddemonhunterethereal_d_01.jpg"
      },
      neck: {
        id: 242406,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace02_etherealribbonorrunestyle_gold.jpg"
      },
      shoulder: {
        id: 237689,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddemonhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237694,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "40"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddemonhunterethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237690,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raiddemonhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237692,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddemonhunterethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237727,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_glaive_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237727,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_glaive_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "DemonHunter",
    spec: "Havoc",
    specId: 577,
    targets: 15,
    talents: "CEkAAAAAAAAAAAAAAAAAAAAAAYmZmZmZmZMzMjhJDzAAAAAAAmFjxMjZmZbMzGWmZwYYssNbzghx2GTyMmZGGWA",
    dps_no_pi: 2937311526e-2,
    dps_with_pi: 3018100276e-2,
    dps_delta: 807887.51,
    dps_pct_gain: 2.75,
    pi_dep_spell_ids: {
      "162264": 162264
    },
    gear: {
      head: {
        id: 237691,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_leather_raiddemonhunterethereal_d_01.jpg"
      },
      neck: {
        id: 242406,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace02_etherealribbonorrunestyle_gold.jpg"
      },
      shoulder: {
        id: 237689,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_leather_raiddemonhunterethereal_d_01.jpg"
      },
      chest: {
        id: 237694,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "40"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_leather_raiddemonhunterethereal_d_01.jpg"
      },
      waist: {
        id: 219331,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237690,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_pant_leather_raiddemonhunterethereal_d_01.jpg"
      },
      feet: {
        id: 243306,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_leather_raidmonkethereal_d_01.jpg"
      },
      wrist: {
        id: 219334,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12922",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213458"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_leather_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237692,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_leather_raiddemonhunterethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237727,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_glaive_1h_etherealraid_d_01.jpg"
      },
      off_hand: {
        id: 237727,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7445"
        ],
        icon: "data/icons/inv_glaive_1h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242396,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_voidprism.jpg"
      }
    }
  },
  {
    class: "Paladin",
    spec: "Retribution",
    specId: 70,
    targets: 5,
    talents: "CYEAAAAAAAAAAAAAAAAAAAAAAAAAAYAAyssNzstsNzYxY22MbDAAAAAAzWTzsYYmx2MY2GGz2MLbjZwghlF2AAAIzMtNLz2MAgNgBAMmhB",
    dps_no_pi: 1835803257e-2,
    dps_with_pi: 1912452316e-2,
    dps_delta: 766490.58,
    dps_pct_gain: 4.18,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237619,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_helm.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237617,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_shoulder.jpg"
      },
      chest: {
        id: 237622,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_chest.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237618,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_pant.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237620,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Paladin",
    spec: "Retribution",
    specId: 70,
    targets: 8,
    talents: "CYEAAAAAAAAAAAAAAAAAAAAAAAAAAYAAyssNzstsNzYxY22MbDAAAAAAzWTzsYYmx2MY2GGz2MLbjZwghlF2AAAIzMtNLz2MAgNgBAMmhB",
    dps_no_pi: 252156696e-1,
    dps_with_pi: 2630200987e-2,
    dps_delta: 108634026e-2,
    dps_pct_gain: 4.31,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237619,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_helm.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237617,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_shoulder.jpg"
      },
      chest: {
        id: 237622,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_chest.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237618,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_pant.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237620,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Paladin",
    spec: "Retribution",
    specId: 70,
    targets: 1,
    talents: "CYEAAAAAAAAAAAAAAAAAAAAAAAAAAYAAamltZmtltxYbMz22MbAAAAAAY00MMMzYbGMbDzysNDDDmhhlF2AAAIzMtNLz2MAgNgBAjxMMD",
    dps_no_pi: 598912346e-2,
    dps_with_pi: 622433798e-2,
    dps_delta: 235214.52,
    dps_pct_gain: 3.93,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237619,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_helm.jpg"
      },
      neck: {
        id: 242406,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213470",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace02_etherealribbonorrunestyle_gold.jpg"
      },
      shoulder: {
        id: 237617,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_shoulder.jpg"
      },
      chest: {
        id: 237622,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_chest.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237618,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_pant.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237620,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213458",
          "213458"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213494",
          "213494"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      }
    }
  },
  {
    class: "Paladin",
    spec: "Retribution",
    specId: 70,
    targets: 15,
    talents: "CYEAAAAAAAAAAAAAAAAAAAAAAAAAAYAAyssNzstsNzYxY22MbDAAAAAAzWTzsYYmx2MY2GGz2MLbjZwghlF2AAAIzMtNLz2MAgNgBAMmhB",
    dps_no_pi: 3609669789e-2,
    dps_with_pi: 377899558e-1,
    dps_delta: 16932579e-1,
    dps_pct_gain: 4.69,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237619,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_helm.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237617,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_shoulder.jpg"
      },
      chest: {
        id: 237622,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_chest.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237618,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_pant.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237620,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Paladin",
    spec: "Retribution",
    specId: 70,
    targets: 3,
    talents: "CYEAAAAAAAAAAAAAAAAAAAAAAAAAAYAAyssNzstsNzYxY22MbDAAAAAAzWTzsYYmx2MY2GGz2MLbjZwghlF2AAAIzMtNLz2MAgNgBAMmhB",
    dps_no_pi: 1134980202e-2,
    dps_with_pi: 118044646e-1,
    dps_delta: 454662.58,
    dps_pct_gain: 4.01,
    pi_dep_spell_ids: {},
    gear: {
      head: {
        id: 237619,
        bonus_ids: [
          "10255",
          "10390",
          "12231",
          "12365",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_helm.jpg"
      },
      neck: {
        id: 215136,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8791",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_11_0_earthen_earthennecklace02_color1.jpg"
      },
      shoulder: {
        id: 237617,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_shoulder.jpg"
      },
      chest: {
        id: 237622,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_chest.jpg"
      },
      waist: {
        id: 222431,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_belt.jpg"
      },
      legs: {
        id: 237618,
        bonus_ids: [
          "10255",
          "10390",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7601"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_pant.jpg"
      },
      feet: {
        id: 243307,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_boot.jpg"
      },
      wrist: {
        id: 222435,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "13468",
          "8791",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_plate_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237620,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_plate_raidpaladinethereal_d_01_glove.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12256",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238046"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237737,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_sword_2h_etherealraid_d_01.jpg"
      },
      finger1: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      finger2: {
        id: 237570,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213491",
          "213491"
        ],
        enchant_ids: [
          "7346"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Evoker",
    spec: "Devastation",
    specId: 1467,
    targets: 15,
    talents: "CsbBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmZGYGmxMDMMGz0wMTmtZWmxMzMzYmlZAGzsNmZMzMwAjBLwyY0YbAZGEshZA",
    dps_no_pi: 3394291353e-2,
    dps_with_pi: 3515246623e-2,
    dps_delta: 12095527e-1,
    dps_pct_gain: 3.56,
    pi_dep_spell_ids: {
      "375087": 375087
    },
    gear: {
      head: {
        id: 237655,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidevokerethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237653,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidevokerethereal_d_01.jpg"
      },
      chest: {
        id: 237658,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidevokerethereal_d_01.jpg"
      },
      waist: {
        id: 245965,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213479"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237654,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_mail_raidevokerethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237656,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidevokerethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8795",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Evoker",
    spec: "Devastation",
    specId: 1467,
    targets: 5,
    talents: "CsbBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmZGYGmxMDMMGz0wMTmtZWmxMzMzYmlZAGzsNmZMzMwAjBLwyY0YbAZGEshZA",
    dps_no_pi: 1645161479e-2,
    dps_with_pi: 1712260913e-2,
    dps_delta: 670994.34,
    dps_pct_gain: 4.08,
    pi_dep_spell_ids: {
      "375087": 375087
    },
    gear: {
      head: {
        id: 237655,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidevokerethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237653,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidevokerethereal_d_01.jpg"
      },
      chest: {
        id: 237658,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidevokerethereal_d_01.jpg"
      },
      waist: {
        id: 245965,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213479"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237654,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_mail_raidevokerethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237656,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidevokerethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8795",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Evoker",
    spec: "Devastation",
    specId: 1467,
    targets: 8,
    talents: "CsbBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmZGYGmxMDMMGz0wMTmtZWmxMzMzYmlZAGzsNmZMzMwAjBLwyY0YbAZGEshZA",
    dps_no_pi: 2176011858e-2,
    dps_with_pi: 2251629309e-2,
    dps_delta: 756174.51,
    dps_pct_gain: 3.48,
    pi_dep_spell_ids: {
      "375087": 375087
    },
    gear: {
      head: {
        id: 237655,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidevokerethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237653,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidevokerethereal_d_01.jpg"
      },
      chest: {
        id: 237658,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidevokerethereal_d_01.jpg"
      },
      waist: {
        id: 245965,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213479"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237654,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_mail_raidevokerethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237656,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidevokerethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8795",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  },
  {
    class: "Evoker",
    spec: "Devastation",
    specId: 1467,
    targets: 1,
    talents: "CsbBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGzMMzsYGmBMYMTzYmJjxyMzMzwYmtZAzYmtxMzyYGMDMjZgNwSwMMBWCWGG",
    dps_no_pi: 596068981e-2,
    dps_with_pi: 625809829e-2,
    dps_delta: 297408.48,
    dps_pct_gain: 4.99,
    pi_dep_spell_ids: {
      "375087": 375087
    },
    gear: {
      head: {
        id: 237655,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidevokerethereal_d_01.jpg"
      },
      neck: {
        id: 237569,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg"
      },
      shoulder: {
        id: 237653,
        bonus_ids: [
          "10255",
          "10356",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidevokerethereal_d_01.jpg"
      },
      chest: {
        id: 237658,
        bonus_ids: [
          "10255",
          "10356",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidevokerethereal_d_01.jpg"
      },
      waist: {
        id: 237522,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_belt_mail_raidhunterethereal_d_01.jpg"
      },
      legs: {
        id: 237654,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_mail_raidevokerethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11109",
          "12050",
          "12053",
          "12922",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213479"
        ],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237656,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidevokerethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12258",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238045"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7442"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213479",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 246281,
        bonus_ids: [
          "10042",
          "10255",
          "10383",
          "10390",
          "10396",
          "10879",
          "13446",
          "6652"
        ],
        gem_ids: [
          "213461",
          "213461"
        ],
        enchant_ids: [
          "7334"
        ],
        icon: "data/icons/inv_misc_60raid_ring_1b.jpg"
      },
      trinket1: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      },
      trinket2: {
        id: 242392,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg"
      }
    }
  },
  {
    class: "Evoker",
    spec: "Devastation",
    specId: 1467,
    targets: 3,
    talents: "CsbBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmZGYGmxMDMMGz0wMTmtZWmxMzMzYmlZAGzsNmZMzMwAjBLwyY0YbAZGEshZA",
    dps_no_pi: 1198132039e-2,
    dps_with_pi: 1231819961e-2,
    dps_delta: 336879.23,
    dps_pct_gain: 2.81,
    pi_dep_spell_ids: {
      "375087": 375087
    },
    gear: {
      head: {
        id: 237655,
        bonus_ids: [
          "10255",
          "10356",
          "12231",
          "12676",
          "12921",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_helm_mail_raidevokerethereal_d_01.jpg"
      },
      neck: {
        id: 237568,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213479",
          "213743"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg"
      },
      shoulder: {
        id: 237653,
        bonus_ids: [
          "10255",
          "10390",
          "12233",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_shoulder_mail_raidevokerethereal_d_01.jpg"
      },
      chest: {
        id: 237658,
        bonus_ids: [
          "10255",
          "10390",
          "12229",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7364"
        ],
        icon: "data/icons/inv_chest_mail_raidevokerethereal_d_01.jpg"
      },
      waist: {
        id: 245965,
        bonus_ids: [
          "12533",
          "1489"
        ],
        gem_ids: [
          "213479"
        ],
        enchant_ids: [],
        icon: "data/icons/inv_armor_waistoftime_d_01_belt_titan_copy.jpg"
      },
      legs: {
        id: 237654,
        bonus_ids: [
          "10255",
          "10356",
          "12232",
          "12676",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7534"
        ],
        icon: "data/icons/inv_pant_mail_raidevokerethereal_d_01.jpg"
      },
      feet: {
        id: 243308,
        bonus_ids: [
          "10255",
          "10356",
          "12239",
          "13446",
          "13504",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7424"
        ],
        icon: "data/icons/inv_boot_mail_raidshamanethereal_d_01.jpg"
      },
      wrist: {
        id: 219342,
        bonus_ids: [
          "10421",
          "11303",
          "12050",
          "12053",
          "12921",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [
          "7385"
        ],
        icon: "data/icons/inv_mail_outdoorarathor_d_01_bracer.jpg"
      },
      hands: {
        id: 237656,
        bonus_ids: [
          "10255",
          "10356",
          "12230",
          "12675",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_glove_mail_raidevokerethereal_d_01.jpg"
      },
      back: {
        id: 235499,
        bonus_ids: [
          "12257",
          "12401",
          "9893"
        ],
        gem_ids: [
          "238044"
        ],
        enchant_ids: [
          "7403"
        ],
        icon: "data/icons/inv_cape_armor_etherealshawl_d_01.jpg"
      },
      main_hand: {
        id: 237728,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [
          "7439"
        ],
        icon: "data/icons/inv_knife_1h_etherealraid_d_02.jpg"
      },
      off_hand: {
        id: 222566,
        bonus_ids: [
          "10421",
          "11300",
          "12050",
          "12053",
          "13468",
          "8790",
          "8902",
          "8960",
          "9627",
          "9633"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_offhand_1h_arathoroutdoor_d_01.jpg"
      },
      finger1: {
        id: 215135,
        bonus_ids: [
          "10396",
          "10421",
          "10879",
          "12050",
          "12053",
          "13468",
          "8795",
          "8902",
          "9627",
          "9633"
        ],
        gem_ids: [
          "213467",
          "213467"
        ],
        enchant_ids: [
          "7352"
        ],
        icon: "data/icons/inv_11_0_earthen_earthenring_color1.jpg"
      },
      finger2: {
        id: 237567,
        bonus_ids: [
          "10255",
          "10356",
          "10396",
          "10879",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [
          "213455",
          "213479"
        ],
        enchant_ids: [
          "7340"
        ],
        icon: "data/icons/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg"
      },
      trinket1: {
        id: 242395,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_silkwormsantenna.jpg"
      },
      trinket2: {
        id: 242402,
        bonus_ids: [
          "10255",
          "10356",
          "13446",
          "1540",
          "6652"
        ],
        gem_ids: [],
        enchant_ids: [],
        icon: "data/icons/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg"
      }
    }
  }
];

// assets/js/pi-generator.js
var dpsLookup = {};
dpsLookup = pi_values_default.reduce((map, row) => {
  const t = row.targets;
  if (!map.has(t)) map.set(t, []);
  map.get(t).push(row);
  return map;
}, /* @__PURE__ */ new Map());
for (let bucket of dpsLookup.values()) {
  bucket.sort((a, b) => b.dps_delta - a.dps_delta);
}
async function generatePiEncodedString(targetCount, mode, dualBossCount, dualTrashCount, iconSize, anchorGroup) {
  const group = createGroupToExport("PiGroup");
  if (anchorGroup) {
    setAnchorPerFrame(group.d, "UNITFRAME");
  }
  let piChatAura = createPiChatAura(dpsLookup);
  addAuraToGroup(group, piChatAura);
  if (mode === "single") {
    generatePiAurasForTargetArray(
      dpsLookup.get(targetCount),
      group,
      void 0,
      iconSize
    );
  } else {
    generatePiAurasForTargetArray(
      dpsLookup.get(dualBossCount),
      group,
      true,
      iconSize
    );
    generatePiAurasForTargetArray(
      dpsLookup.get(dualTrashCount),
      group,
      false,
      iconSize
    );
  }
  const encoded = await encode(group, false);
  return encoded;
}
function createPiAuraEntry(spec, spellIds, targetArray, loadInEncounter, iconSize, key) {
  let aura = JSON.parse(JSON.stringify(piAura_default));
  setAuraId(aura, `${spec.class} - ${spec.spec} [${spec.targets}]`);
  setAuraUid(aura, `WACreator_PI_${spec.class}_${spec.spec}_${spec.targets}`);
  setLoadInBossfight(aura, loadInEncounter);
  setAuraWidth(aura, iconSize);
  setAuraHeight(aura, iconSize);
  let buffTrigger = JSON.parse(JSON.stringify(Triggers.buff));
  setSpellIds(buffTrigger, spellIds, true);
  setTriggerUnit(buffTrigger, "Group");
  setDeBuffType(buffTrigger, "buff");
  addSpecId(buffTrigger, spec.specId);
  addTrigger(aura, buffTrigger);
  setTriggerIncludesPets(buffTrigger, true);
  let piCooldownTrigger = JSON.parse(JSON.stringify(Triggers.cooldown));
  addTrigger(aura, piCooldownTrigger);
  if (key !== "0") {
    let specTrigger = JSON.parse(
      JSON.stringify(Triggers.unit_characteristics)
    );
    for (const childkey in targetArray) {
      if (Number(childkey) >= Number(key)) {
        break;
      }
      addSpecId(specTrigger, targetArray[childkey].specId);
    }
    addTrigger(aura, specTrigger);
    setTriggerMode(
      aura,
      "custom",
      "function(t) return t[1] and t[2] and not t[3] end"
    );
  }
  return aura;
}
function generatePiAurasForTargetArray(targetArray, group, loadInEncounter, iconSize) {
  for (const key in targetArray) {
    const spec = targetArray[key];
    let spellIds = {};
    let idx = 1;
    if (Object.keys(spec).length !== 0) {
      for (const [key2, val] of Object.entries(spec.pi_dep_spell_ids)) {
        if (val) {
          spellIds[idx++] = val.toString();
        }
      }
    }
    if (Object.keys(spellIds).length === 0) continue;
    let aura = createPiAuraEntry(spec, spellIds, targetArray, loadInEncounter, iconSize, key);
    addAuraToGroup(group, aura);
  }
}
function createPiChatAura(dpsLookup2) {
  let aura = JSON.parse(JSON.stringify(emptyRegion_default));
  setAuraId(aura, `PI Anouncer`);
  setAuraUid(aura, `WACreator_PI_Anouncer`);
  setActionsOnShowCustom(aura, piChatAura_default.actions.start.custom);
  let piList = "{";
  for (const [targetCount, entries] of dpsLookup2) {
    piList += `[${targetCount}] = {`;
    for (const entry of entries) {
      piList += `[${entry.specId}] = { gain = ${entry.dps_delta > 0 ? Math.round(entry.dps_delta) : 0} },`;
    }
    piList += "},";
  }
  piList += "}";
  const updated = (/* @__PURE__ */ new Date()).toLocaleString(void 0, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  let init = `aura_env.piList=${piList} 
aura_env.updated = "${updated}" 
 ${piChatAura_default.actions.init.custom}`;
  setActionsOnInitCustom(aura, init);
  let eventTrigger = JSON.parse(JSON.stringify(Triggers.event));
  setCustomTrigger(eventTrigger, piChatAura_default.triggers[0].trigger.custom_trigger, piChatAura_default.triggers[0].trigger.events, 10);
  addTrigger(aura, eventTrigger);
  setAuthorOptions(aura, piChatAura_default.authorOptions);
  return aura;
}
async function generatePiAura() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const anchorGroup = document.getElementById("anchorGroupToggle").checked;
  const iconSize = document.getElementById("iconSizeSelect").value;
  const targetCount = Number(document.getElementById("targetSelectOverall").value);
  const dualBossCount = Number(document.getElementById("targetSelectBoss").value);
  const dualTrashCount = Number(document.getElementById("targetSelectTrash").value);
  let output = await generatePiEncodedString(targetCount, mode, dualBossCount, dualTrashCount, iconSize, anchorGroup);
  document.getElementById("piOutput").value = output;
  document.getElementById("piCopyButton").disabled = false;
}
window.generatePiAura = generatePiAura;
export {
  createPiAuraEntry,
  createPiChatAura,
  generatePiAura,
  generatePiAurasForTargetArray,
  generatePiEncodedString
};
/*! Bundled license information:

pako/dist/pako.esm.mjs:
  (*! pako 2.1.0 https://github.com/nodeca/pako @license (MIT AND Zlib) *)
*/
