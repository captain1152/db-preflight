#!/usr/bin/env node
// db-preflight 0.1.0 - bundled CLI. License: MIT. Third-party notices: THIRD_PARTY_LICENSES.txt
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/postgres-array@2.0.0/node_modules/postgres-array/index.js
var require_postgres_array = __commonJS({
  "node_modules/.pnpm/postgres-array@2.0.0/node_modules/postgres-array/index.js"(exports2) {
    "use strict";
    exports2.parse = function(source, transform) {
      return new ArrayParser(source, transform).parse();
    };
    var ArrayParser = class _ArrayParser {
      constructor(source, transform) {
        this.source = source;
        this.transform = transform || identity;
        this.position = 0;
        this.entries = [];
        this.recorded = [];
        this.dimension = 0;
      }
      isEof() {
        return this.position >= this.source.length;
      }
      nextCharacter() {
        var character = this.source[this.position++];
        if (character === "\\") {
          return {
            value: this.source[this.position++],
            escaped: true
          };
        }
        return {
          value: character,
          escaped: false
        };
      }
      record(character) {
        this.recorded.push(character);
      }
      newEntry(includeEmpty) {
        var entry;
        if (this.recorded.length > 0 || includeEmpty) {
          entry = this.recorded.join("");
          if (entry === "NULL" && !includeEmpty) {
            entry = null;
          }
          if (entry !== null) entry = this.transform(entry);
          this.entries.push(entry);
          this.recorded = [];
        }
      }
      consumeDimensions() {
        if (this.source[0] === "[") {
          while (!this.isEof()) {
            var char = this.nextCharacter();
            if (char.value === "=") break;
          }
        }
      }
      parse(nested) {
        var character, parser, quote;
        this.consumeDimensions();
        while (!this.isEof()) {
          character = this.nextCharacter();
          if (character.value === "{" && !quote) {
            this.dimension++;
            if (this.dimension > 1) {
              parser = new _ArrayParser(this.source.substr(this.position - 1), this.transform);
              this.entries.push(parser.parse(true));
              this.position += parser.position - 2;
            }
          } else if (character.value === "}" && !quote) {
            this.dimension--;
            if (!this.dimension) {
              this.newEntry();
              if (nested) return this.entries;
            }
          } else if (character.value === '"' && !character.escaped) {
            if (quote) this.newEntry(true);
            quote = !quote;
          } else if (character.value === "," && !quote) {
            this.newEntry();
          } else {
            this.record(character.value);
          }
        }
        if (this.dimension !== 0) {
          throw new Error("array dimension not balanced");
        }
        return this.entries;
      }
    };
    function identity(value) {
      return value;
    }
  }
});

// node_modules/.pnpm/pg-types@2.2.0/node_modules/pg-types/lib/arrayParser.js
var require_arrayParser = __commonJS({
  "node_modules/.pnpm/pg-types@2.2.0/node_modules/pg-types/lib/arrayParser.js"(exports2, module2) {
    var array = require_postgres_array();
    module2.exports = {
      create: function(source, transform) {
        return {
          parse: function() {
            return array.parse(source, transform);
          }
        };
      }
    };
  }
});

// node_modules/.pnpm/postgres-date@1.0.7/node_modules/postgres-date/index.js
var require_postgres_date = __commonJS({
  "node_modules/.pnpm/postgres-date@1.0.7/node_modules/postgres-date/index.js"(exports2, module2) {
    "use strict";
    var DATE_TIME = /(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$/;
    var DATE = /^(\d{1,})-(\d{2})-(\d{2})( BC)?$/;
    var TIME_ZONE = /([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?/;
    var INFINITY = /^-?infinity$/;
    module2.exports = function parseDate(isoDate) {
      if (INFINITY.test(isoDate)) {
        return Number(isoDate.replace("i", "I"));
      }
      var matches = DATE_TIME.exec(isoDate);
      if (!matches) {
        return getDate(isoDate) || null;
      }
      var isBC = !!matches[8];
      var year = parseInt(matches[1], 10);
      if (isBC) {
        year = bcYearToNegativeYear(year);
      }
      var month = parseInt(matches[2], 10) - 1;
      var day = matches[3];
      var hour = parseInt(matches[4], 10);
      var minute = parseInt(matches[5], 10);
      var second = parseInt(matches[6], 10);
      var ms = matches[7];
      ms = ms ? 1e3 * parseFloat(ms) : 0;
      var date;
      var offset = timeZoneOffset(isoDate);
      if (offset != null) {
        date = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
        if (is0To99(year)) {
          date.setUTCFullYear(year);
        }
        if (offset !== 0) {
          date.setTime(date.getTime() - offset);
        }
      } else {
        date = new Date(year, month, day, hour, minute, second, ms);
        if (is0To99(year)) {
          date.setFullYear(year);
        }
      }
      return date;
    };
    function getDate(isoDate) {
      var matches = DATE.exec(isoDate);
      if (!matches) {
        return;
      }
      var year = parseInt(matches[1], 10);
      var isBC = !!matches[4];
      if (isBC) {
        year = bcYearToNegativeYear(year);
      }
      var month = parseInt(matches[2], 10) - 1;
      var day = matches[3];
      var date = new Date(year, month, day);
      if (is0To99(year)) {
        date.setFullYear(year);
      }
      return date;
    }
    function timeZoneOffset(isoDate) {
      if (isoDate.endsWith("+00")) {
        return 0;
      }
      var zone = TIME_ZONE.exec(isoDate.split(" ")[1]);
      if (!zone) return;
      var type = zone[1];
      if (type === "Z") {
        return 0;
      }
      var sign = type === "-" ? -1 : 1;
      var offset = parseInt(zone[2], 10) * 3600 + parseInt(zone[3] || 0, 10) * 60 + parseInt(zone[4] || 0, 10);
      return offset * sign * 1e3;
    }
    function bcYearToNegativeYear(year) {
      return -(year - 1);
    }
    function is0To99(num) {
      return num >= 0 && num < 100;
    }
  }
});

// node_modules/.pnpm/xtend@4.0.2/node_modules/xtend/mutable.js
var require_mutable = __commonJS({
  "node_modules/.pnpm/xtend@4.0.2/node_modules/xtend/mutable.js"(exports2, module2) {
    module2.exports = extend;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function extend(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key2 in source) {
          if (hasOwnProperty.call(source, key2)) {
            target[key2] = source[key2];
          }
        }
      }
      return target;
    }
  }
});

// node_modules/.pnpm/postgres-interval@1.2.0/node_modules/postgres-interval/index.js
var require_postgres_interval = __commonJS({
  "node_modules/.pnpm/postgres-interval@1.2.0/node_modules/postgres-interval/index.js"(exports2, module2) {
    "use strict";
    var extend = require_mutable();
    module2.exports = PostgresInterval;
    function PostgresInterval(raw) {
      if (!(this instanceof PostgresInterval)) {
        return new PostgresInterval(raw);
      }
      extend(this, parse(raw));
    }
    var properties = ["seconds", "minutes", "hours", "days", "months", "years"];
    PostgresInterval.prototype.toPostgres = function() {
      var filtered = properties.filter(this.hasOwnProperty, this);
      if (this.milliseconds && filtered.indexOf("seconds") < 0) {
        filtered.push("seconds");
      }
      if (filtered.length === 0) return "0";
      return filtered.map(function(property) {
        var value = this[property] || 0;
        if (property === "seconds" && this.milliseconds) {
          value = (value + this.milliseconds / 1e3).toFixed(6).replace(/\.?0+$/, "");
        }
        return value + " " + property;
      }, this).join(" ");
    };
    var propertiesISOEquivalent = {
      years: "Y",
      months: "M",
      days: "D",
      hours: "H",
      minutes: "M",
      seconds: "S"
    };
    var dateProperties = ["years", "months", "days"];
    var timeProperties = ["hours", "minutes", "seconds"];
    PostgresInterval.prototype.toISOString = PostgresInterval.prototype.toISO = function() {
      var datePart = dateProperties.map(buildProperty, this).join("");
      var timePart = timeProperties.map(buildProperty, this).join("");
      return "P" + datePart + "T" + timePart;
      function buildProperty(property) {
        var value = this[property] || 0;
        if (property === "seconds" && this.milliseconds) {
          value = (value + this.milliseconds / 1e3).toFixed(6).replace(/0+$/, "");
        }
        return value + propertiesISOEquivalent[property];
      }
    };
    var NUMBER = "([+-]?\\d+)";
    var YEAR = NUMBER + "\\s+years?";
    var MONTH = NUMBER + "\\s+mons?";
    var DAY = NUMBER + "\\s+days?";
    var TIME = "([+-])?([\\d]*):(\\d\\d):(\\d\\d)\\.?(\\d{1,6})?";
    var INTERVAL = new RegExp([YEAR, MONTH, DAY, TIME].map(function(regexString) {
      return "(" + regexString + ")?";
    }).join("\\s*"));
    var positions = {
      years: 2,
      months: 4,
      days: 6,
      hours: 9,
      minutes: 10,
      seconds: 11,
      milliseconds: 12
    };
    var negatives = ["hours", "minutes", "seconds", "milliseconds"];
    function parseMilliseconds(fraction) {
      var microseconds = fraction + "000000".slice(fraction.length);
      return parseInt(microseconds, 10) / 1e3;
    }
    function parse(interval) {
      if (!interval) return {};
      var matches = INTERVAL.exec(interval);
      var isNegative = matches[8] === "-";
      return Object.keys(positions).reduce(function(parsed, property) {
        var position = positions[property];
        var value = matches[position];
        if (!value) return parsed;
        value = property === "milliseconds" ? parseMilliseconds(value) : parseInt(value, 10);
        if (!value) return parsed;
        if (isNegative && ~negatives.indexOf(property)) {
          value *= -1;
        }
        parsed[property] = value;
        return parsed;
      }, {});
    }
  }
});

// node_modules/.pnpm/postgres-bytea@1.0.1/node_modules/postgres-bytea/index.js
var require_postgres_bytea = __commonJS({
  "node_modules/.pnpm/postgres-bytea@1.0.1/node_modules/postgres-bytea/index.js"(exports2, module2) {
    "use strict";
    var bufferFrom = Buffer.from || Buffer;
    module2.exports = function parseBytea(input) {
      if (/^\\x/.test(input)) {
        return bufferFrom(input.substr(2), "hex");
      }
      var output = "";
      var i = 0;
      while (i < input.length) {
        if (input[i] !== "\\") {
          output += input[i];
          ++i;
        } else {
          if (/[0-7]{3}/.test(input.substr(i + 1, 3))) {
            output += String.fromCharCode(parseInt(input.substr(i + 1, 3), 8));
            i += 4;
          } else {
            var backslashes = 1;
            while (i + backslashes < input.length && input[i + backslashes] === "\\") {
              backslashes++;
            }
            for (var k = 0; k < Math.floor(backslashes / 2); ++k) {
              output += "\\";
            }
            i += Math.floor(backslashes / 2) * 2;
          }
        }
      }
      return bufferFrom(output, "binary");
    };
  }
});

// node_modules/.pnpm/pg-types@2.2.0/node_modules/pg-types/lib/textParsers.js
var require_textParsers = __commonJS({
  "node_modules/.pnpm/pg-types@2.2.0/node_modules/pg-types/lib/textParsers.js"(exports2, module2) {
    var array = require_postgres_array();
    var arrayParser = require_arrayParser();
    var parseDate = require_postgres_date();
    var parseInterval = require_postgres_interval();
    var parseByteA = require_postgres_bytea();
    function allowNull(fn) {
      return function nullAllowed(value) {
        if (value === null) return value;
        return fn(value);
      };
    }
    function parseBool(value) {
      if (value === null) return value;
      return value === "TRUE" || value === "t" || value === "true" || value === "y" || value === "yes" || value === "on" || value === "1";
    }
    function parseBoolArray(value) {
      if (!value) return null;
      return array.parse(value, parseBool);
    }
    function parseBaseTenInt(string) {
      return parseInt(string, 10);
    }
    function parseIntegerArray(value) {
      if (!value) return null;
      return array.parse(value, allowNull(parseBaseTenInt));
    }
    function parseBigIntegerArray(value) {
      if (!value) return null;
      return array.parse(value, allowNull(function(entry) {
        return parseBigInteger(entry).trim();
      }));
    }
    var parsePointArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parsePoint(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseFloatArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseFloat(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseStringArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value);
      return p.parse();
    };
    var parseDateArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseDate(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseIntervalArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseInterval(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseByteAArray = function(value) {
      if (!value) {
        return null;
      }
      return array.parse(value, allowNull(parseByteA));
    };
    var parseInteger = function(value) {
      return parseInt(value, 10);
    };
    var parseBigInteger = function(value) {
      var valStr = String(value);
      if (/^\d+$/.test(valStr)) {
        return valStr;
      }
      return value;
    };
    var parseJsonArray = function(value) {
      if (!value) {
        return null;
      }
      return array.parse(value, allowNull(JSON.parse));
    };
    var parsePoint = function(value) {
      if (value[0] !== "(") {
        return null;
      }
      value = value.substring(1, value.length - 1).split(",");
      return {
        x: parseFloat(value[0]),
        y: parseFloat(value[1])
      };
    };
    var parseCircle = function(value) {
      if (value[0] !== "<" && value[1] !== "(") {
        return null;
      }
      var point = "(";
      var radius = "";
      var pointParsed = false;
      for (var i = 2; i < value.length - 1; i++) {
        if (!pointParsed) {
          point += value[i];
        }
        if (value[i] === ")") {
          pointParsed = true;
          continue;
        } else if (!pointParsed) {
          continue;
        }
        if (value[i] === ",") {
          continue;
        }
        radius += value[i];
      }
      var result = parsePoint(point);
      result.radius = parseFloat(radius);
      return result;
    };
    var init = function(register) {
      register(20, parseBigInteger);
      register(21, parseInteger);
      register(23, parseInteger);
      register(26, parseInteger);
      register(700, parseFloat);
      register(701, parseFloat);
      register(16, parseBool);
      register(1082, parseDate);
      register(1114, parseDate);
      register(1184, parseDate);
      register(600, parsePoint);
      register(651, parseStringArray);
      register(718, parseCircle);
      register(1e3, parseBoolArray);
      register(1001, parseByteAArray);
      register(1005, parseIntegerArray);
      register(1007, parseIntegerArray);
      register(1028, parseIntegerArray);
      register(1016, parseBigIntegerArray);
      register(1017, parsePointArray);
      register(1021, parseFloatArray);
      register(1022, parseFloatArray);
      register(1231, parseFloatArray);
      register(1014, parseStringArray);
      register(1015, parseStringArray);
      register(1008, parseStringArray);
      register(1009, parseStringArray);
      register(1040, parseStringArray);
      register(1041, parseStringArray);
      register(1115, parseDateArray);
      register(1182, parseDateArray);
      register(1185, parseDateArray);
      register(1186, parseInterval);
      register(1187, parseIntervalArray);
      register(17, parseByteA);
      register(114, JSON.parse.bind(JSON));
      register(3802, JSON.parse.bind(JSON));
      register(199, parseJsonArray);
      register(3807, parseJsonArray);
      register(3907, parseStringArray);
      register(2951, parseStringArray);
      register(791, parseStringArray);
      register(1183, parseStringArray);
      register(1270, parseStringArray);
    };
    module2.exports = {
      init
    };
  }
});

// node_modules/.pnpm/pg-int8@1.0.1/node_modules/pg-int8/index.js
var require_pg_int8 = __commonJS({
  "node_modules/.pnpm/pg-int8@1.0.1/node_modules/pg-int8/index.js"(exports2, module2) {
    "use strict";
    var BASE = 1e6;
    function readInt8(buffer) {
      var high = buffer.readInt32BE(0);
      var low = buffer.readUInt32BE(4);
      var sign = "";
      if (high < 0) {
        high = ~high + (low === 0);
        low = ~low + 1 >>> 0;
        sign = "-";
      }
      var result = "";
      var carry;
      var t;
      var digits;
      var pad;
      var l;
      var i;
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        t = 4294967296 * carry + low;
        digits = "" + t % BASE;
        return sign + digits + result;
      }
    }
    module2.exports = readInt8;
  }
});

// node_modules/.pnpm/pg-types@2.2.0/node_modules/pg-types/lib/binaryParsers.js
var require_binaryParsers = __commonJS({
  "node_modules/.pnpm/pg-types@2.2.0/node_modules/pg-types/lib/binaryParsers.js"(exports2, module2) {
    var parseInt64 = require_pg_int8();
    var parseBits = function(data, bits, offset, invert, callback) {
      offset = offset || 0;
      invert = invert || false;
      callback = callback || function(lastValue, newValue, bits2) {
        return lastValue * Math.pow(2, bits2) + newValue;
      };
      var offsetBytes = offset >> 3;
      var inv = function(value) {
        if (invert) {
          return ~value & 255;
        }
        return value;
      };
      var mask = 255;
      var firstBits = 8 - offset % 8;
      if (bits < firstBits) {
        mask = 255 << 8 - bits & 255;
        firstBits = bits;
      }
      if (offset) {
        mask = mask >> offset % 8;
      }
      var result = 0;
      if (offset % 8 + bits >= 8) {
        result = callback(0, inv(data[offsetBytes]) & mask, firstBits);
      }
      var bytes = bits + offset >> 3;
      for (var i = offsetBytes + 1; i < bytes; i++) {
        result = callback(result, inv(data[i]), 8);
      }
      var lastBits = (bits + offset) % 8;
      if (lastBits > 0) {
        result = callback(result, inv(data[bytes]) >> 8 - lastBits, lastBits);
      }
      return result;
    };
    var parseFloatFromBits = function(data, precisionBits, exponentBits) {
      var bias = Math.pow(2, exponentBits - 1) - 1;
      var sign = parseBits(data, 1);
      var exponent = parseBits(data, exponentBits, 1);
      if (exponent === 0) {
        return 0;
      }
      var precisionBitsCounter = 1;
      var parsePrecisionBits = function(lastValue, newValue, bits) {
        if (lastValue === 0) {
          lastValue = 1;
        }
        for (var i = 1; i <= bits; i++) {
          precisionBitsCounter /= 2;
          if ((newValue & 1 << bits - i) > 0) {
            lastValue += precisionBitsCounter;
          }
        }
        return lastValue;
      };
      var mantissa = parseBits(data, precisionBits, exponentBits + 1, false, parsePrecisionBits);
      if (exponent == Math.pow(2, exponentBits + 1) - 1) {
        if (mantissa === 0) {
          return sign === 0 ? Infinity : -Infinity;
        }
        return NaN;
      }
      return (sign === 0 ? 1 : -1) * Math.pow(2, exponent - bias) * mantissa;
    };
    var parseInt16 = function(value) {
      if (parseBits(value, 1) == 1) {
        return -1 * (parseBits(value, 15, 1, true) + 1);
      }
      return parseBits(value, 15, 1);
    };
    var parseInt32 = function(value) {
      if (parseBits(value, 1) == 1) {
        return -1 * (parseBits(value, 31, 1, true) + 1);
      }
      return parseBits(value, 31, 1);
    };
    var parseFloat32 = function(value) {
      return parseFloatFromBits(value, 23, 8);
    };
    var parseFloat64 = function(value) {
      return parseFloatFromBits(value, 52, 11);
    };
    var parseNumeric = function(value) {
      var sign = parseBits(value, 16, 32);
      if (sign == 49152) {
        return NaN;
      }
      var weight = Math.pow(1e4, parseBits(value, 16, 16));
      var result = 0;
      var digits = [];
      var ndigits = parseBits(value, 16);
      for (var i = 0; i < ndigits; i++) {
        result += parseBits(value, 16, 64 + 16 * i) * weight;
        weight /= 1e4;
      }
      var scale = Math.pow(10, parseBits(value, 16, 48));
      return (sign === 0 ? 1 : -1) * Math.round(result * scale) / scale;
    };
    var parseDate = function(isUTC, value) {
      var sign = parseBits(value, 1);
      var rawValue = parseBits(value, 63, 1);
      var result = new Date((sign === 0 ? 1 : -1) * rawValue / 1e3 + 9466848e5);
      if (!isUTC) {
        result.setTime(result.getTime() + result.getTimezoneOffset() * 6e4);
      }
      result.usec = rawValue % 1e3;
      result.getMicroSeconds = function() {
        return this.usec;
      };
      result.setMicroSeconds = function(value2) {
        this.usec = value2;
      };
      result.getUTCMicroSeconds = function() {
        return this.usec;
      };
      return result;
    };
    var parseArray = function(value) {
      var dim = parseBits(value, 32);
      var flags = parseBits(value, 32, 32);
      var elementType = parseBits(value, 32, 64);
      var offset = 96;
      var dims = [];
      for (var i = 0; i < dim; i++) {
        dims[i] = parseBits(value, 32, offset);
        offset += 32;
        offset += 32;
      }
      var parseElement = function(elementType2) {
        var length = parseBits(value, 32, offset);
        offset += 32;
        if (length == 4294967295) {
          return null;
        }
        var result;
        if (elementType2 == 23 || elementType2 == 20) {
          result = parseBits(value, length * 8, offset);
          offset += length * 8;
          return result;
        } else if (elementType2 == 25) {
          result = value.toString(this.encoding, offset >> 3, (offset += length << 3) >> 3);
          return result;
        } else {
          console.log("ERROR: ElementType not implemented: " + elementType2);
        }
      };
      var parse = function(dimension, elementType2) {
        var array = [];
        var i2;
        if (dimension.length > 1) {
          var count = dimension.shift();
          for (i2 = 0; i2 < count; i2++) {
            array[i2] = parse(dimension, elementType2);
          }
          dimension.unshift(count);
        } else {
          for (i2 = 0; i2 < dimension[0]; i2++) {
            array[i2] = parseElement(elementType2);
          }
        }
        return array;
      };
      return parse(dims, elementType);
    };
    var parseText = function(value) {
      return value.toString("utf8");
    };
    var parseBool = function(value) {
      if (value === null) return null;
      return parseBits(value, 8) > 0;
    };
    var init = function(register) {
      register(20, parseInt64);
      register(21, parseInt16);
      register(23, parseInt32);
      register(26, parseInt32);
      register(1700, parseNumeric);
      register(700, parseFloat32);
      register(701, parseFloat64);
      register(16, parseBool);
      register(1114, parseDate.bind(null, false));
      register(1184, parseDate.bind(null, true));
      register(1e3, parseArray);
      register(1007, parseArray);
      register(1016, parseArray);
      register(1008, parseArray);
      register(1009, parseArray);
      register(25, parseText);
    };
    module2.exports = {
      init
    };
  }
});

// node_modules/.pnpm/pg-types@2.2.0/node_modules/pg-types/lib/builtins.js
var require_builtins = __commonJS({
  "node_modules/.pnpm/pg-types@2.2.0/node_modules/pg-types/lib/builtins.js"(exports2, module2) {
    module2.exports = {
      BOOL: 16,
      BYTEA: 17,
      CHAR: 18,
      INT8: 20,
      INT2: 21,
      INT4: 23,
      REGPROC: 24,
      TEXT: 25,
      OID: 26,
      TID: 27,
      XID: 28,
      CID: 29,
      JSON: 114,
      XML: 142,
      PG_NODE_TREE: 194,
      SMGR: 210,
      PATH: 602,
      POLYGON: 604,
      CIDR: 650,
      FLOAT4: 700,
      FLOAT8: 701,
      ABSTIME: 702,
      RELTIME: 703,
      TINTERVAL: 704,
      CIRCLE: 718,
      MACADDR8: 774,
      MONEY: 790,
      MACADDR: 829,
      INET: 869,
      ACLITEM: 1033,
      BPCHAR: 1042,
      VARCHAR: 1043,
      DATE: 1082,
      TIME: 1083,
      TIMESTAMP: 1114,
      TIMESTAMPTZ: 1184,
      INTERVAL: 1186,
      TIMETZ: 1266,
      BIT: 1560,
      VARBIT: 1562,
      NUMERIC: 1700,
      REFCURSOR: 1790,
      REGPROCEDURE: 2202,
      REGOPER: 2203,
      REGOPERATOR: 2204,
      REGCLASS: 2205,
      REGTYPE: 2206,
      UUID: 2950,
      TXID_SNAPSHOT: 2970,
      PG_LSN: 3220,
      PG_NDISTINCT: 3361,
      PG_DEPENDENCIES: 3402,
      TSVECTOR: 3614,
      TSQUERY: 3615,
      GTSVECTOR: 3642,
      REGCONFIG: 3734,
      REGDICTIONARY: 3769,
      JSONB: 3802,
      REGNAMESPACE: 4089,
      REGROLE: 4096
    };
  }
});

// node_modules/.pnpm/pg-types@2.2.0/node_modules/pg-types/index.js
var require_pg_types = __commonJS({
  "node_modules/.pnpm/pg-types@2.2.0/node_modules/pg-types/index.js"(exports2) {
    var textParsers = require_textParsers();
    var binaryParsers = require_binaryParsers();
    var arrayParser = require_arrayParser();
    var builtinTypes = require_builtins();
    exports2.getTypeParser = getTypeParser;
    exports2.setTypeParser = setTypeParser;
    exports2.arrayParser = arrayParser;
    exports2.builtins = builtinTypes;
    var typeParsers = {
      text: {},
      binary: {}
    };
    function noParse(val) {
      return String(val);
    }
    function getTypeParser(oid, format) {
      format = format || "text";
      if (!typeParsers[format]) {
        return noParse;
      }
      return typeParsers[format][oid] || noParse;
    }
    function setTypeParser(oid, format, parseFn) {
      if (typeof format == "function") {
        parseFn = format;
        format = "text";
      }
      typeParsers[format][oid] = parseFn;
    }
    textParsers.init(function(oid, converter) {
      typeParsers.text[oid] = converter;
    });
    binaryParsers.init(function(oid, converter) {
      typeParsers.binary[oid] = converter;
    });
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/defaults.js
var require_defaults = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/defaults.js"(exports2, module2) {
    "use strict";
    var user;
    try {
      user = process.platform === "win32" ? process.env.USERNAME : process.env.USER;
    } catch {
    }
    module2.exports = {
      // database host. defaults to localhost
      host: "localhost",
      // database user's name
      user,
      // name of database to connect
      database: void 0,
      // database user's password
      password: null,
      // a Postgres connection string to be used instead of setting individual connection items
      // NOTE:  Setting this value will cause it to override any other value (such as database or user) defined
      // in the defaults object.
      connectionString: void 0,
      // database port
      port: 5432,
      // number of rows to return at a time from a prepared statement's
      // portal. 0 will return all rows at once
      rows: 0,
      // binary result mode
      binary: false,
      // Connection pool options - see https://github.com/brianc/node-pg-pool
      // number of connections to use in connection pool
      // 0 will disable connection pooling
      max: 10,
      // max milliseconds a client can go unused before it is removed
      // from the pool and destroyed
      idleTimeoutMillis: 3e4,
      client_encoding: "",
      ssl: false,
      // SSL negotiation style: 'postgres' (traditional SSLRequest) or 'direct'
      sslnegotiation: void 0,
      application_name: void 0,
      fallback_application_name: void 0,
      options: void 0,
      parseInputDatesAsUTC: false,
      // max milliseconds any query using this connection will execute for before timing out in error.
      // false=unlimited
      statement_timeout: false,
      // Abort any statement that waits longer than the specified duration in milliseconds while attempting to acquire a lock.
      // false=unlimited
      lock_timeout: false,
      // Terminate any session with an open transaction that has been idle for longer than the specified duration in milliseconds
      // false=unlimited
      idle_in_transaction_session_timeout: false,
      // max milliseconds to wait for query to complete (client side)
      query_timeout: false,
      connect_timeout: 0,
      keepalives: 1,
      keepalives_idle: 0
    };
    var pgTypes = require_pg_types();
    var parseBigInteger = pgTypes.getTypeParser(20, "text");
    var parseBigIntegerArray = pgTypes.getTypeParser(1016, "text");
    module2.exports.__defineSetter__("parseInt8", function(val) {
      pgTypes.setTypeParser(20, "text", val ? pgTypes.getTypeParser(23, "text") : parseBigInteger);
      pgTypes.setTypeParser(1016, "text", val ? pgTypes.getTypeParser(1007, "text") : parseBigIntegerArray);
    });
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/utils.js
var require_utils = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/utils.js"(exports2, module2) {
    "use strict";
    var defaults2 = require_defaults();
    var nodeUtils = require("util");
    var { isDate } = require("util/types");
    var invalidDateDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Sending an invalid date to Postgres is deprecated and will throw an error in the next major version of pg. Ensure any Date object passed as a query parameter is valid.",
      "PG_INVALID_DATE"
    );
    function escapeElement(elementRepresentation) {
      const escaped = elementRepresentation.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return '"' + escaped + '"';
    }
    function arrayString(val) {
      let result = "{";
      for (let i = 0; i < val.length; i++) {
        if (i > 0) {
          result += ",";
        }
        let item = val[i];
        if (item == null) {
          result += "NULL";
        } else if (Array.isArray(item)) {
          result += arrayString(item);
        } else if (ArrayBuffer.isView(item)) {
          if (!(item instanceof Buffer)) {
            item = Buffer.from(item.buffer, item.byteOffset, item.byteLength);
          }
          result += "\\\\x" + item.toString("hex");
        } else {
          result += escapeElement(prepareValue(item));
        }
      }
      result += "}";
      return result;
    }
    var prepareValue = function(val, seen) {
      if (val == null) {
        return null;
      }
      if (typeof val === "object") {
        if (val instanceof Buffer) {
          return val;
        }
        if (ArrayBuffer.isView(val)) {
          return Buffer.from(val.buffer, val.byteOffset, val.byteLength);
        }
        if (isDate(val)) {
          if (isNaN(val.getTime())) {
            invalidDateDeprecationNotice();
          }
          if (defaults2.parseInputDatesAsUTC) {
            return dateToStringUTC(val);
          } else {
            return dateToString(val);
          }
        }
        if (Array.isArray(val)) {
          return arrayString(val);
        }
        return prepareObject(val, seen);
      }
      return val.toString();
    };
    function prepareObject(val, seen) {
      if (val && typeof val.toPostgres === "function") {
        seen = seen || [];
        if (seen.indexOf(val) !== -1) {
          throw new Error('circular reference detected while preparing "' + val + '" for query');
        }
        seen.push(val);
        return prepareValue(val.toPostgres(prepareValue), seen);
      }
      return JSON.stringify(val);
    }
    function dateToString(date) {
      let offset = -date.getTimezoneOffset();
      let year = date.getFullYear();
      const isBCYear = year < 1;
      if (isBCYear) year = Math.abs(year) + 1;
      let ret = String(year).padStart(4, "0") + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0") + "T" + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0") + ":" + String(date.getSeconds()).padStart(2, "0") + "." + String(date.getMilliseconds()).padStart(3, "0");
      if (offset < 0) {
        ret += "-";
        offset *= -1;
      } else {
        ret += "+";
      }
      ret += String(Math.floor(offset / 60)).padStart(2, "0") + ":" + String(offset % 60).padStart(2, "0");
      if (isBCYear) ret += " BC";
      return ret;
    }
    function dateToStringUTC(date) {
      let year = date.getUTCFullYear();
      const isBCYear = year < 1;
      if (isBCYear) year = Math.abs(year) + 1;
      let ret = String(year).padStart(4, "0") + "-" + String(date.getUTCMonth() + 1).padStart(2, "0") + "-" + String(date.getUTCDate()).padStart(2, "0") + "T" + String(date.getUTCHours()).padStart(2, "0") + ":" + String(date.getUTCMinutes()).padStart(2, "0") + ":" + String(date.getUTCSeconds()).padStart(2, "0") + "." + String(date.getUTCMilliseconds()).padStart(3, "0");
      ret += "+00:00";
      if (isBCYear) ret += " BC";
      return ret;
    }
    function normalizeQueryConfig(config, values, callback) {
      config = typeof config === "string" ? { text: config } : cloneQueryConfig(config);
      if (values) {
        if (typeof values === "function") {
          config.callback = values;
        } else {
          config.values = values;
        }
      }
      if (callback) {
        config.callback = callback;
      }
      return config;
    }
    function cloneQueryConfig(config) {
      if (config == null) {
        return config;
      }
      return Object.defineProperties(Object.create(Object.getPrototypeOf(config)), Object.getOwnPropertyDescriptors(config));
    }
    var escapeIdentifier2 = function(str2) {
      return '"' + str2.replace(/"/g, '""') + '"';
    };
    var escapeLiteral2 = function(str2) {
      let hasBackslash = false;
      let escaped = "'";
      if (str2 == null) {
        return "''";
      }
      if (typeof str2 !== "string") {
        return "''";
      }
      for (let i = 0; i < str2.length; i++) {
        const c = str2[i];
        if (c === "'") {
          escaped += c + c;
        } else if (c === "\\") {
          escaped += c + c;
          hasBackslash = true;
        } else {
          escaped += c;
        }
      }
      escaped += "'";
      if (hasBackslash === true) {
        escaped = " E" + escaped;
      }
      return escaped;
    };
    module2.exports = {
      prepareValue: function prepareValueWrapper(value) {
        return prepareValue(value);
      },
      normalizeQueryConfig,
      escapeIdentifier: escapeIdentifier2,
      escapeLiteral: escapeLiteral2
    };
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/crypto/utils.js
var require_utils2 = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/crypto/utils.js"(exports2, module2) {
    var nodeCrypto = require("crypto");
    module2.exports = {
      postgresMd5PasswordHash,
      randomBytes: randomBytes2,
      deriveKey,
      sha256,
      hashByName,
      hmacSha256,
      md5
    };
    var webCrypto = nodeCrypto.webcrypto || globalThis.crypto;
    var subtleCrypto = webCrypto.subtle;
    var textEncoder = new TextEncoder();
    function randomBytes2(length) {
      return webCrypto.getRandomValues(Buffer.alloc(length));
    }
    async function md5(string) {
      try {
        return nodeCrypto.createHash("md5").update(string, "utf-8").digest("hex");
      } catch (e) {
        const data = typeof string === "string" ? textEncoder.encode(string) : string;
        const hash = await subtleCrypto.digest("MD5", data);
        return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    }
    async function postgresMd5PasswordHash(user, password, salt) {
      const inner = await md5(password + user);
      const outer = await md5(Buffer.concat([Buffer.from(inner), salt]));
      return "md5" + outer;
    }
    async function sha256(text) {
      return await subtleCrypto.digest("SHA-256", text);
    }
    async function hashByName(hashName, text) {
      return await subtleCrypto.digest(hashName, text);
    }
    async function hmacSha256(keyBuffer, msg) {
      const key2 = await subtleCrypto.importKey("raw", keyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      return await subtleCrypto.sign("HMAC", key2, textEncoder.encode(msg));
    }
    async function deriveKey(password, salt, iterations) {
      const key2 = await subtleCrypto.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
      const params = { name: "PBKDF2", hash: "SHA-256", salt, iterations };
      return await subtleCrypto.deriveBits(params, key2, 32 * 8, ["deriveBits"]);
    }
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/crypto/cert-signatures.js
var require_cert_signatures = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/crypto/cert-signatures.js"(exports2, module2) {
    function x509Error(msg, cert) {
      return new Error("SASL channel binding: " + msg + " when parsing public certificate " + cert.toString("base64"));
    }
    function readASN1Length(data, index) {
      let length = data[index++];
      if (length < 128) return { length, index };
      const lengthBytes = length & 127;
      if (lengthBytes > 4) throw x509Error("bad length", data);
      length = 0;
      for (let i = 0; i < lengthBytes; i++) {
        length = length << 8 | data[index++];
      }
      return { length, index };
    }
    function readASN1OID(data, index) {
      if (data[index++] !== 6) throw x509Error("non-OID data", data);
      const { length: OIDLength, index: indexAfterOIDLength } = readASN1Length(data, index);
      index = indexAfterOIDLength;
      const lastIndex = index + OIDLength;
      const byte1 = data[index++];
      let oid = (byte1 / 40 >> 0) + "." + byte1 % 40;
      while (index < lastIndex) {
        let value = 0;
        while (index < lastIndex) {
          const nextByte = data[index++];
          value = value << 7 | nextByte & 127;
          if (nextByte < 128) break;
        }
        oid += "." + value;
      }
      return { oid, index };
    }
    function expectASN1Seq(data, index) {
      if (data[index++] !== 48) throw x509Error("non-sequence data", data);
      return readASN1Length(data, index);
    }
    function signatureAlgorithmHashFromCertificate(data, index) {
      if (index === void 0) index = 0;
      index = expectASN1Seq(data, index).index;
      const { length: certInfoLength, index: indexAfterCertInfoLength } = expectASN1Seq(data, index);
      index = indexAfterCertInfoLength + certInfoLength;
      index = expectASN1Seq(data, index).index;
      const { oid, index: indexAfterOID } = readASN1OID(data, index);
      switch (oid) {
        // RSA
        case "1.2.840.113549.1.1.4":
          return "MD5";
        case "1.2.840.113549.1.1.5":
          return "SHA-1";
        case "1.2.840.113549.1.1.11":
          return "SHA-256";
        case "1.2.840.113549.1.1.12":
          return "SHA-384";
        case "1.2.840.113549.1.1.13":
          return "SHA-512";
        case "1.2.840.113549.1.1.14":
          return "SHA-224";
        case "1.2.840.113549.1.1.15":
          return "SHA512-224";
        case "1.2.840.113549.1.1.16":
          return "SHA512-256";
        // ECDSA
        case "1.2.840.10045.4.1":
          return "SHA-1";
        case "1.2.840.10045.4.3.1":
          return "SHA-224";
        case "1.2.840.10045.4.3.2":
          return "SHA-256";
        case "1.2.840.10045.4.3.3":
          return "SHA-384";
        case "1.2.840.10045.4.3.4":
          return "SHA-512";
        // RSASSA-PSS: hash is indicated separately
        case "1.2.840.113549.1.1.10": {
          index = indexAfterOID;
          index = expectASN1Seq(data, index).index;
          if (data[index++] !== 160) throw x509Error("non-tag data", data);
          index = readASN1Length(data, index).index;
          index = expectASN1Seq(data, index).index;
          const { oid: hashOID } = readASN1OID(data, index);
          switch (hashOID) {
            // standalone hash OIDs
            case "1.2.840.113549.2.5":
              return "MD5";
            case "1.3.14.3.2.26":
              return "SHA-1";
            case "2.16.840.1.101.3.4.2.1":
              return "SHA-256";
            case "2.16.840.1.101.3.4.2.2":
              return "SHA-384";
            case "2.16.840.1.101.3.4.2.3":
              return "SHA-512";
          }
          throw x509Error("unknown hash OID " + hashOID, data);
        }
        // Ed25519 -- see https://github.com/openssl/openssl/issues/15477
        case "1.3.101.110":
        case "1.3.101.112":
          return "SHA-512";
        // Ed448 -- still not in pg 17.2 (if supported, digest would be SHAKE256 x 64 bytes)
        case "1.3.101.111":
        case "1.3.101.113":
          throw x509Error("Ed448 certificate channel binding is not currently supported by Postgres");
      }
      throw x509Error("unknown OID " + oid, data);
    }
    module2.exports = { signatureAlgorithmHashFromCertificate };
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/crypto/sasl.js
var require_sasl = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/crypto/sasl.js"(exports2, module2) {
    "use strict";
    var crypto = require_utils2();
    var { signatureAlgorithmHashFromCertificate } = require_cert_signatures();
    function saslprep(password) {
      const nonAsciiSpace = /[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g;
      const mappedToNothing = /[\u00AD\u034F\u1806\u180B\u180C\u180D\u200C\u200D\u2060\uFE00-\uFE0F\uFEFF]/g;
      return password.replace(nonAsciiSpace, " ").replace(mappedToNothing, "").normalize("NFKC");
    }
    var DEFAULT_MAX_SCRAM_ITERATIONS = 1e5;
    function startSession(mechanisms, stream, scramMaxIterations = DEFAULT_MAX_SCRAM_ITERATIONS) {
      const candidates = ["SCRAM-SHA-256"];
      if (stream) candidates.unshift("SCRAM-SHA-256-PLUS");
      const mechanism = candidates.find((candidate) => mechanisms.includes(candidate));
      if (!mechanism) {
        throw new Error("SASL: Only mechanism(s) " + candidates.join(" and ") + " are supported");
      }
      if (mechanism === "SCRAM-SHA-256-PLUS" && typeof stream.getPeerCertificate !== "function") {
        throw new Error("SASL: Mechanism SCRAM-SHA-256-PLUS requires a certificate");
      }
      const clientNonce = crypto.randomBytes(18).toString("base64");
      const gs2Header = mechanism === "SCRAM-SHA-256-PLUS" ? "p=tls-server-end-point" : stream ? "y" : "n";
      return {
        mechanism,
        clientNonce,
        response: gs2Header + ",,n=*,r=" + clientNonce,
        message: "SASLInitialResponse",
        scramMaxIterations
      };
    }
    async function continueSession(session, password, serverData, stream) {
      if (session.message !== "SASLInitialResponse") {
        throw new Error("SASL: Last message was not SASLInitialResponse");
      }
      if (typeof password !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string");
      }
      if (password === "") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string");
      }
      if (typeof serverData !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: serverData must be a string");
      }
      const sv = parseServerFirstMessage(serverData);
      if (!sv.nonce.startsWith(session.clientNonce)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce");
      } else if (sv.nonce.length === session.clientNonce.length) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short");
      }
      const scramMaxIterations = typeof session.scramMaxIterations === "number" ? session.scramMaxIterations : DEFAULT_MAX_SCRAM_ITERATIONS;
      if (scramMaxIterations !== 0 && sv.iteration > scramMaxIterations) {
        throw new Error(
          "SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration count " + sv.iteration + " exceeds scramMaxIterations of " + scramMaxIterations
        );
      }
      const clientFirstMessageBare = "n=*,r=" + session.clientNonce;
      const serverFirstMessage = "r=" + sv.nonce + ",s=" + sv.salt + ",i=" + sv.iteration;
      let channelBinding = stream ? "eSws" : "biws";
      if (session.mechanism === "SCRAM-SHA-256-PLUS") {
        const peerCert = stream.getPeerCertificate().raw;
        let hashName = signatureAlgorithmHashFromCertificate(peerCert);
        if (hashName === "MD5" || hashName === "SHA-1") hashName = "SHA-256";
        const certHash = await crypto.hashByName(hashName, peerCert);
        const bindingData = Buffer.concat([Buffer.from("p=tls-server-end-point,,"), Buffer.from(certHash)]);
        channelBinding = bindingData.toString("base64");
      }
      const clientFinalMessageWithoutProof = "c=" + channelBinding + ",r=" + sv.nonce;
      const authMessage = clientFirstMessageBare + "," + serverFirstMessage + "," + clientFinalMessageWithoutProof;
      const saltBytes = Buffer.from(sv.salt, "base64");
      const saltedPassword = await crypto.deriveKey(saslprep(password), saltBytes, sv.iteration);
      const clientKey = await crypto.hmacSha256(saltedPassword, "Client Key");
      const storedKey = await crypto.sha256(clientKey);
      const clientSignature = await crypto.hmacSha256(storedKey, authMessage);
      const clientProof = xorBuffers(Buffer.from(clientKey), Buffer.from(clientSignature)).toString("base64");
      const serverKey = await crypto.hmacSha256(saltedPassword, "Server Key");
      const serverSignatureBytes = await crypto.hmacSha256(serverKey, authMessage);
      session.message = "SASLResponse";
      session.serverSignature = Buffer.from(serverSignatureBytes).toString("base64");
      session.response = clientFinalMessageWithoutProof + ",p=" + clientProof;
    }
    function finalizeSession(session, serverData) {
      if (session.message !== "SASLResponse") {
        throw new Error("SASL: Last message was not SASLResponse");
      }
      if (typeof serverData !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: serverData must be a string");
      }
      const { serverSignature } = parseServerFinalMessage(serverData);
      if (serverSignature !== session.serverSignature) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match");
      }
    }
    function isPrintableChars(text) {
      if (typeof text !== "string") {
        throw new TypeError("SASL: text must be a string");
      }
      return text.split("").map((_, i) => text.charCodeAt(i)).every((c) => c >= 33 && c <= 43 || c >= 45 && c <= 126);
    }
    function isBase64(text) {
      return /^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(text);
    }
    function parseAttributePairs(text) {
      if (typeof text !== "string") {
        throw new TypeError("SASL: attribute pairs text must be a string");
      }
      return new Map(
        text.split(",").map((attrValue) => {
          if (!/^.=/.test(attrValue)) {
            throw new Error("SASL: Invalid attribute pair entry");
          }
          const name = attrValue[0];
          const value = attrValue.substring(2);
          return [name, value];
        })
      );
    }
    function parseServerFirstMessage(data) {
      const attrPairs = parseAttributePairs(data);
      const nonce = attrPairs.get("r");
      if (!nonce) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing");
      } else if (!isPrintableChars(nonce)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce must only contain printable characters");
      }
      const salt = attrPairs.get("s");
      if (!salt) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing");
      } else if (!isBase64(salt)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt must be base64");
      }
      const iterationText = attrPairs.get("i");
      if (!iterationText) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration missing");
      } else if (!/^[1-9][0-9]*$/.test(iterationText)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: invalid iteration count");
      }
      const iteration = parseInt(iterationText, 10);
      return {
        nonce,
        salt,
        iteration
      };
    }
    function parseServerFinalMessage(serverData) {
      const attrPairs = parseAttributePairs(serverData);
      const error = attrPairs.get("e");
      const serverSignature = attrPairs.get("v");
      if (error) {
        throw new Error(`SASL: SCRAM-SERVER-FINAL-MESSAGE: server returned error: "${error}"`);
      }
      if (!serverSignature) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing");
      } else if (!isBase64(serverSignature)) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature must be base64");
      }
      return {
        serverSignature
      };
    }
    function xorBuffers(a, b) {
      if (!Buffer.isBuffer(a)) {
        throw new TypeError("first argument must be a Buffer");
      }
      if (!Buffer.isBuffer(b)) {
        throw new TypeError("second argument must be a Buffer");
      }
      if (a.length !== b.length) {
        throw new Error("Buffer lengths must match");
      }
      if (a.length === 0) {
        throw new Error("Buffers cannot be empty");
      }
      return Buffer.from(a.map((_, i) => a[i] ^ b[i]));
    }
    module2.exports = {
      startSession,
      continueSession,
      finalizeSession,
      DEFAULT_MAX_SCRAM_ITERATIONS
    };
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/type-overrides.js
var require_type_overrides = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/type-overrides.js"(exports2, module2) {
    "use strict";
    var types2 = require_pg_types();
    function TypeOverrides2(userTypes) {
      this._types = userTypes || types2;
      this.text = {};
      this.binary = {};
    }
    TypeOverrides2.prototype.getOverrides = function(format) {
      switch (format) {
        case "text":
          return this.text;
        case "binary":
          return this.binary;
        default:
          return {};
      }
    };
    TypeOverrides2.prototype.setTypeParser = function(oid, format, parseFn) {
      if (typeof format === "function") {
        parseFn = format;
        format = "text";
      }
      this.getOverrides(format)[oid] = parseFn;
    };
    TypeOverrides2.prototype.getTypeParser = function(oid, format) {
      format = format || "text";
      return this.getOverrides(format)[oid] || this._types.getTypeParser(oid, format);
    };
    module2.exports = TypeOverrides2;
  }
});

// node_modules/.pnpm/pg-connection-string@2.14.1/node_modules/pg-connection-string/index.js
var require_pg_connection_string = __commonJS({
  "node_modules/.pnpm/pg-connection-string@2.14.1/node_modules/pg-connection-string/index.js"(exports2, module2) {
    "use strict";
    function parse(str2, options = {}) {
      if (str2.charAt(0) === "/") {
        const config2 = str2.split(" ");
        return { host: config2[0], database: config2[1] };
      }
      const config = /* @__PURE__ */ Object.create(null);
      let result;
      let dummyHost = false;
      if (/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(str2)) {
        str2 = encodeURI(str2).replace(/%25(\d\d)/g, "%$1");
      }
      try {
        try {
          result = new URL(str2, "postgres://base");
        } catch (e) {
          result = new URL(str2.replace("@/", "@___DUMMY___/"), "postgres://base");
          dummyHost = true;
        }
      } catch (err) {
        err.input && (err.input = "*****REDACTED*****");
        throw err;
      }
      for (const entry of result.searchParams.entries()) {
        config[entry[0]] = entry[1];
      }
      config.user = config.user || decodeURIComponent(result.username);
      config.password = config.password || decodeURIComponent(result.password);
      if (result.protocol == "socket:") {
        config.host = decodeURI(result.pathname);
        config.database = result.searchParams.get("db");
        config.client_encoding = result.searchParams.get("encoding");
        return config;
      }
      const hostname = (dummyHost ? "" : result.hostname).replace(/^\[(.+)\]$/, "$1");
      if (!config.host) {
        config.host = decodeURIComponent(hostname);
      } else if (hostname && /^%2f/i.test(hostname)) {
        result.pathname = hostname + result.pathname;
      }
      if (!config.port) {
        config.port = result.port;
      }
      const pathname = result.pathname.slice(1) || null;
      config.database = pathname ? decodeURI(pathname) : null;
      if (config.ssl === "true" || config.ssl === "1") {
        config.ssl = true;
      }
      if (config.ssl === "0") {
        config.ssl = false;
      }
      if (config.sslcert || config.sslkey || config.sslrootcert || config.sslmode) {
        config.ssl = {};
      }
      if (config.sslnegotiation === "direct" && config.ssl === void 0) {
        config.ssl = true;
      }
      const fs = config.sslcert || config.sslkey || config.sslrootcert ? require("fs") : null;
      if (config.sslcert) {
        config.ssl.cert = fs.readFileSync(config.sslcert).toString();
      }
      if (config.sslkey) {
        config.ssl.key = fs.readFileSync(config.sslkey).toString();
      }
      if (config.sslrootcert) {
        config.ssl.ca = fs.readFileSync(config.sslrootcert).toString();
      }
      if (options.useLibpqCompat && config.uselibpqcompat) {
        throw new Error("Both useLibpqCompat and uselibpqcompat are set. Please use only one of them.");
      }
      if (config.uselibpqcompat === "true" || options.useLibpqCompat) {
        switch (config.sslmode) {
          case "disable": {
            config.ssl = false;
            break;
          }
          case "prefer": {
            config.ssl.rejectUnauthorized = false;
            break;
          }
          case "require": {
            if (config.sslrootcert) {
              config.ssl.checkServerIdentity = function() {
              };
            } else {
              config.ssl.rejectUnauthorized = false;
            }
            break;
          }
          case "verify-ca": {
            if (!config.ssl.ca) {
              throw new Error(
                "SECURITY WARNING: Using sslmode=verify-ca requires specifying a CA with sslrootcert. If a public CA is used, verify-ca allows connections to a server that somebody else may have registered with the CA, making you vulnerable to Man-in-the-Middle attacks. Either specify a custom CA certificate with sslrootcert parameter or use sslmode=verify-full for proper security."
              );
            }
            config.ssl.checkServerIdentity = function() {
            };
            break;
          }
          case "verify-full": {
            break;
          }
        }
      } else {
        switch (config.sslmode) {
          case "disable": {
            config.ssl = false;
            break;
          }
          case "prefer":
          case "require":
          case "verify-ca":
          case "verify-full": {
            if (config.sslmode !== "verify-full") {
              deprecatedSslModeWarning(config.sslmode);
            }
            break;
          }
          case "no-verify": {
            config.ssl.rejectUnauthorized = false;
            break;
          }
        }
      }
      return config;
    }
    function toConnectionOptions(sslConfig) {
      const connectionOptions = Object.entries(sslConfig).reduce((c, [key2, value]) => {
        if (value !== void 0 && value !== null) {
          c[key2] = value;
        }
        return c;
      }, /* @__PURE__ */ Object.create(null));
      return connectionOptions;
    }
    function toClientConfig(config) {
      const poolConfig = Object.entries(config).reduce((c, [key2, value]) => {
        if (key2 === "ssl") {
          const sslConfig = value;
          if (typeof sslConfig === "boolean") {
            c[key2] = sslConfig;
          }
          if (typeof sslConfig === "object") {
            c[key2] = toConnectionOptions(sslConfig);
          }
        } else if (value !== void 0 && value !== null) {
          if (key2 === "port") {
            if (value !== "") {
              const v = parseInt(value, 10);
              if (isNaN(v)) {
                throw new Error(`Invalid ${key2}: ${value}`);
              }
              c[key2] = v;
            }
          } else {
            c[key2] = value;
          }
        }
        return c;
      }, /* @__PURE__ */ Object.create(null));
      return poolConfig;
    }
    function parseIntoClientConfig(str2) {
      return toClientConfig(parse(str2));
    }
    function deprecatedSslModeWarning(sslmode) {
      if (!deprecatedSslModeWarning.warned && typeof process !== "undefined" && process.emitWarning) {
        deprecatedSslModeWarning.warned = true;
        process.emitWarning(`SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard libpq semantics, which have weaker security guarantees.

To prepare for this change:
- If you want the current behavior, explicitly use 'sslmode=verify-full'
- If you want libpq compatibility now, use 'uselibpqcompat=true&sslmode=${sslmode}'

See https://www.postgresql.org/docs/current/libpq-ssl.html for libpq SSL mode definitions.`);
      }
    }
    module2.exports = parse;
    parse.parse = parse;
    parse.toClientConfig = toClientConfig;
    parse.parseIntoClientConfig = parseIntoClientConfig;
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/connection-parameters.js
var require_connection_parameters = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/connection-parameters.js"(exports2, module2) {
    "use strict";
    var dns = require("dns");
    var defaults2 = require_defaults();
    var parse = require_pg_connection_string().parse;
    var val = function(key2, config, envVar) {
      if (config[key2]) {
        return config[key2];
      }
      if (envVar === void 0) {
        envVar = process.env["PG" + key2.toUpperCase()];
      } else if (envVar === false) {
      } else {
        envVar = process.env[envVar];
      }
      return envVar || defaults2[key2];
    };
    var readSSLConfigFromEnvironment = function() {
      switch (process.env.PGSSLMODE) {
        case "disable":
          return false;
        case "prefer":
        case "require":
        case "verify-ca":
        case "verify-full":
          return true;
        case "no-verify":
          return { rejectUnauthorized: false };
      }
      return defaults2.ssl;
    };
    var quoteParamValue = function(value) {
      return "'" + ("" + value).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
    };
    var add = function(params, config, paramName) {
      const value = config[paramName];
      if (value !== void 0 && value !== null) {
        params.push(paramName + "=" + quoteParamValue(value));
      }
    };
    var ConnectionParameters = class {
      constructor(config) {
        config = typeof config === "string" ? parse(config) : config || {};
        if (config.connectionString) {
          config = Object.assign({}, config, parse(config.connectionString));
        }
        this.user = val("user", config);
        this.database = val("database", config);
        if (this.database === void 0) {
          this.database = this.user;
        }
        this.port = parseInt(val("port", config), 10);
        this.host = val("host", config);
        Object.defineProperty(this, "password", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: val("password", config)
        });
        this.binary = val("binary", config);
        this.options = val("options", config);
        this.ssl = typeof config.ssl === "undefined" ? readSSLConfigFromEnvironment() : config.ssl;
        if (typeof this.ssl === "string") {
          if (this.ssl === "true") {
            this.ssl = true;
          }
        }
        if (this.ssl === "no-verify") {
          this.ssl = { rejectUnauthorized: false };
        }
        if (this.ssl && this.ssl.key) {
          Object.defineProperty(this.ssl, "key", {
            enumerable: false
          });
        }
        this.sslnegotiation = val("sslnegotiation", config, "PGSSLNEGOTIATION");
        if (this.sslnegotiation !== void 0 && this.sslnegotiation !== "postgres" && this.sslnegotiation !== "direct") {
          throw new Error(
            `Invalid sslnegotiation value: "${this.sslnegotiation}". Valid values are "postgres" and "direct".`
          );
        }
        if (this.sslnegotiation === "direct" && !this.ssl) {
          throw new Error("sslnegotiation=direct requires SSL to be enabled");
        }
        this.client_encoding = val("client_encoding", config);
        this.replication = val("replication", config);
        this.isDomainSocket = !(this.host || "").indexOf("/");
        this.application_name = val("application_name", config, "PGAPPNAME");
        this.fallback_application_name = val("fallback_application_name", config, false);
        this.statement_timeout = val("statement_timeout", config, false);
        this.lock_timeout = val("lock_timeout", config, false);
        this.idle_in_transaction_session_timeout = val("idle_in_transaction_session_timeout", config, false);
        this.query_timeout = val("query_timeout", config, false);
        if (config.connectionTimeoutMillis === void 0) {
          this.connect_timeout = process.env.PGCONNECT_TIMEOUT || 0;
        } else {
          this.connect_timeout = Math.floor(config.connectionTimeoutMillis / 1e3);
        }
        if (config.keepAlive === false) {
          this.keepalives = 0;
        } else if (config.keepAlive === true) {
          this.keepalives = 1;
        }
        if (typeof config.keepAliveInitialDelayMillis === "number") {
          this.keepalives_idle = Math.floor(config.keepAliveInitialDelayMillis / 1e3);
        }
      }
      getLibpqConnectionString(cb) {
        const params = [];
        add(params, this, "user");
        add(params, this, "password");
        add(params, this, "port");
        add(params, this, "application_name");
        add(params, this, "fallback_application_name");
        add(params, this, "connect_timeout");
        add(params, this, "options");
        const ssl = typeof this.ssl === "object" ? this.ssl : this.ssl ? { sslmode: this.ssl } : {};
        add(params, ssl, "sslmode");
        add(params, ssl, "sslca");
        add(params, ssl, "sslkey");
        add(params, ssl, "sslcert");
        add(params, ssl, "sslrootcert");
        add(params, this, "sslnegotiation");
        if (this.database) {
          params.push("dbname=" + quoteParamValue(this.database));
        }
        if (this.replication) {
          params.push("replication=" + quoteParamValue(this.replication));
        }
        if (this.host) {
          params.push("host=" + quoteParamValue(this.host));
        }
        if (this.isDomainSocket) {
          return cb(null, params.join(" "));
        }
        if (this.client_encoding) {
          params.push("client_encoding=" + quoteParamValue(this.client_encoding));
        }
        dns.lookup(this.host, function(err, address) {
          if (err) return cb(err, null);
          params.push("hostaddr=" + quoteParamValue(address));
          return cb(null, params.join(" "));
        });
      }
    };
    module2.exports = ConnectionParameters;
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/result.js
var require_result = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/result.js"(exports2, module2) {
    "use strict";
    var types2 = require_pg_types();
    var matchRegexp = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;
    var Result2 = class {
      constructor(rowMode, types3) {
        this.command = null;
        this.rowCount = null;
        this.oid = null;
        this.rows = [];
        this.fields = [];
        this._parsers = void 0;
        this._types = types3;
        this.RowCtor = null;
        this.rowAsArray = rowMode === "array";
        if (this.rowAsArray) {
          this.parseRow = this._parseRowAsArray;
        }
        this._prebuiltEmptyResultObject = null;
      }
      // adds a command complete message
      addCommandComplete(msg) {
        let match;
        if (msg.text) {
          match = matchRegexp.exec(msg.text);
        } else {
          match = matchRegexp.exec(msg.command);
        }
        if (match) {
          this.command = match[1];
          if (match[3]) {
            this.oid = parseInt(match[2], 10);
            this.rowCount = parseInt(match[3], 10);
          } else if (match[2]) {
            this.rowCount = parseInt(match[2], 10);
          }
        }
      }
      _parseRowAsArray(rowData) {
        const row = new Array(rowData.length);
        for (let i = 0, len = rowData.length; i < len; i++) {
          const rawValue = rowData[i];
          if (rawValue !== null) {
            row[i] = this._parsers[i](rawValue);
          } else {
            row[i] = null;
          }
        }
        return row;
      }
      parseRow(rowData) {
        const row = { ...this._prebuiltEmptyResultObject };
        for (let i = 0, len = rowData.length; i < len; i++) {
          const rawValue = rowData[i];
          const field = this.fields[i].name;
          if (rawValue !== null) {
            const v = this.fields[i].format === "binary" ? Buffer.from(rawValue) : rawValue;
            row[field] = this._parsers[i](v);
          } else {
            row[field] = null;
          }
        }
        return row;
      }
      addRow(row) {
        this.rows.push(row);
      }
      addFields(fieldDescriptions) {
        this.fields = fieldDescriptions;
        if (this.fields.length) {
          this._parsers = new Array(fieldDescriptions.length);
        }
        const row = /* @__PURE__ */ Object.create(null);
        for (let i = 0; i < fieldDescriptions.length; i++) {
          const desc = fieldDescriptions[i];
          row[desc.name] = null;
          if (this._types) {
            this._parsers[i] = this._types.getTypeParser(desc.dataTypeID, desc.format || "text");
          } else {
            this._parsers[i] = types2.getTypeParser(desc.dataTypeID, desc.format || "text");
          }
        }
        this._prebuiltEmptyResultObject = { ...row };
      }
    };
    module2.exports = Result2;
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/query.js
var require_query = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/query.js"(exports2, module2) {
    "use strict";
    var { EventEmitter } = require("events");
    var Result2 = require_result();
    var utils = require_utils();
    var Query2 = class extends EventEmitter {
      constructor(config, values, callback) {
        super();
        config = utils.normalizeQueryConfig(config, values, callback);
        this.text = config.text;
        this.values = config.values;
        this.rows = config.rows;
        this.types = config.types;
        this.name = config.name;
        this.queryMode = config.queryMode;
        this.binary = config.binary;
        this.portal = config.portal || "";
        this.callback = config.callback;
        this._rowMode = config.rowMode;
        if (process.domain && config.callback) {
          this.callback = process.domain.bind(config.callback);
        }
        this._result = new Result2(this._rowMode, this.types);
        this._results = this._result;
        this._canceledDueToError = false;
      }
      requiresPreparation() {
        if (this.queryMode === "extended") {
          return true;
        }
        if (this.name) {
          return true;
        }
        if (this.rows) {
          return true;
        }
        if (!this.text) {
          return false;
        }
        if (!this.values) {
          return false;
        }
        return this.values.length > 0;
      }
      _checkForMultirow() {
        if (this._result.command) {
          if (!Array.isArray(this._results)) {
            this._results = [this._result];
          }
          this._result = new Result2(this._rowMode, this._result._types);
          this._results.push(this._result);
        }
      }
      // associates row metadata from the supplied
      // message with this query object
      // metadata used when parsing row results
      handleRowDescription(msg) {
        this._checkForMultirow();
        this._result.addFields(msg.fields);
        this._accumulateRows = this.callback || !this.listeners("row").length;
      }
      handleDataRow(msg) {
        let row;
        if (this._canceledDueToError) {
          return;
        }
        try {
          row = this._result.parseRow(msg.fields);
        } catch (err) {
          this._canceledDueToError = err;
          return;
        }
        this.emit("row", row, this._result);
        if (this._accumulateRows) {
          this._result.addRow(row);
        }
      }
      handleCommandComplete(msg, connection) {
        this._checkForMultirow();
        this._result.addCommandComplete(msg);
        if (this.rows) {
          connection.sync();
        }
      }
      // if a named prepared statement is created with empty query text
      // the backend will send an emptyQuery message but *not* a command complete message
      // since we pipeline sync immediately after execute we don't need to do anything here
      // unless we have rows specified, in which case we did not pipeline the initial sync call
      handleEmptyQuery(connection) {
        if (this.rows) {
          connection.sync();
        }
      }
      handleError(err, connection) {
        if (this._canceledDueToError) {
          err = this._canceledDueToError;
          this._canceledDueToError = false;
        }
        if (this.callback) {
          return this.callback(err);
        }
        this.emit("error", err);
      }
      handleReadyForQuery(con) {
        if (this._canceledDueToError) {
          return this.handleError(this._canceledDueToError, con);
        }
        if (this.callback) {
          try {
            this.callback(null, this._results);
          } catch (err) {
            process.nextTick(() => {
              throw err;
            });
          }
        }
        this.emit("end", this._results);
      }
      submit(connection) {
        if (typeof this.text !== "string" && typeof this.name !== "string") {
          return new Error("A query must have either text or a name. Supplying neither is unsupported.");
        }
        const previous = connection.parsedStatements[this.name] || connection.submittedNamedStatements[this.name];
        if (this.text && previous && this.text !== previous) {
          return new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
        }
        if (this.values && !Array.isArray(this.values)) {
          return new Error("Query values must be an array");
        }
        if (this.requiresPreparation()) {
          connection.stream.cork && connection.stream.cork();
          try {
            this.prepare(connection);
          } finally {
            connection.stream.uncork && connection.stream.uncork();
          }
        } else {
          connection.query(this.text);
        }
        return null;
      }
      hasBeenParsed(connection) {
        return this.name && (connection.parsedStatements[this.name] !== void 0 || connection.submittedNamedStatements[this.name] !== void 0);
      }
      handlePortalSuspended(connection) {
        this._getRows(connection, this.rows);
      }
      _getRows(connection, rows) {
        connection.execute({
          portal: this.portal,
          rows
        });
        if (!rows) {
          connection.sync();
        } else {
          connection.flush();
        }
      }
      // http://developer.postgresql.org/pgdocs/postgres/protocol-flow.html#PROTOCOL-FLOW-EXT-QUERY
      prepare(connection) {
        if (!this.hasBeenParsed(connection)) {
          connection.parse({
            text: this.text,
            name: this.name,
            types: this.types
          });
          if (this.name) {
            connection.submittedNamedStatements[this.name] = this.text;
          }
        }
        try {
          connection.bind({
            portal: this.portal,
            statement: this.name,
            values: this.values,
            binary: this.binary,
            valueMapper: utils.prepareValue
          });
        } catch (err) {
          connection.close({ type: "S", name: this.name });
          connection.sync();
          this.handleError(err, connection);
          return;
        }
        connection.describe({
          type: "P",
          name: this.portal || ""
        });
        this._getRows(connection, this.rows);
      }
      handleCopyInResponse(connection) {
        connection.sendCopyFail("No source stream defined");
      }
      handleCopyData(msg, connection) {
      }
    };
    module2.exports = Query2;
  }
});

// node_modules/.pnpm/pg-protocol@1.16.1/node_modules/pg-protocol/dist/messages.js
var require_messages = __commonJS({
  "node_modules/.pnpm/pg-protocol@1.16.1/node_modules/pg-protocol/dist/messages.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.NoticeMessage = exports2.DataRowMessage = exports2.CommandCompleteMessage = exports2.ReadyForQueryMessage = exports2.NotificationResponseMessage = exports2.BackendKeyDataMessage = exports2.AuthenticationMD5Password = exports2.ParameterStatusMessage = exports2.ParameterDescriptionMessage = exports2.RowDescriptionMessage = exports2.Field = exports2.CopyResponse = exports2.CopyDataMessage = exports2.DatabaseError = exports2.copyDone = exports2.emptyQuery = exports2.replicationStart = exports2.portalSuspended = exports2.noData = exports2.closeComplete = exports2.bindComplete = exports2.parseComplete = void 0;
    exports2.parseComplete = {
      name: "parseComplete",
      length: 5
    };
    exports2.bindComplete = {
      name: "bindComplete",
      length: 5
    };
    exports2.closeComplete = {
      name: "closeComplete",
      length: 5
    };
    exports2.noData = {
      name: "noData",
      length: 5
    };
    exports2.portalSuspended = {
      name: "portalSuspended",
      length: 5
    };
    exports2.replicationStart = {
      name: "replicationStart",
      length: 4
    };
    exports2.emptyQuery = {
      name: "emptyQuery",
      length: 4
    };
    exports2.copyDone = {
      name: "copyDone",
      length: 4
    };
    var DatabaseError2 = class extends Error {
      constructor(message, length, name) {
        super(message);
        this.length = length;
        this.name = name;
      }
    };
    exports2.DatabaseError = DatabaseError2;
    var CopyDataMessage = class {
      constructor(length, chunk) {
        this.length = length;
        this.chunk = chunk;
        this.name = "copyData";
      }
    };
    exports2.CopyDataMessage = CopyDataMessage;
    var CopyResponse = class {
      constructor(length, name, binary, columnCount) {
        this.length = length;
        this.name = name;
        this.binary = binary;
        this.columnTypes = new Array(columnCount);
      }
    };
    exports2.CopyResponse = CopyResponse;
    var Field = class {
      constructor(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, format) {
        this.name = name;
        this.tableID = tableID;
        this.columnID = columnID;
        this.dataTypeID = dataTypeID;
        this.dataTypeSize = dataTypeSize;
        this.dataTypeModifier = dataTypeModifier;
        this.format = format;
      }
    };
    exports2.Field = Field;
    var RowDescriptionMessage = class {
      constructor(length, fieldCount) {
        this.length = length;
        this.fieldCount = fieldCount;
        this.name = "rowDescription";
        this.fields = new Array(this.fieldCount);
      }
    };
    exports2.RowDescriptionMessage = RowDescriptionMessage;
    var ParameterDescriptionMessage = class {
      constructor(length, parameterCount) {
        this.length = length;
        this.parameterCount = parameterCount;
        this.name = "parameterDescription";
        this.dataTypeIDs = new Array(this.parameterCount);
      }
    };
    exports2.ParameterDescriptionMessage = ParameterDescriptionMessage;
    var ParameterStatusMessage = class {
      constructor(length, parameterName, parameterValue) {
        this.length = length;
        this.parameterName = parameterName;
        this.parameterValue = parameterValue;
        this.name = "parameterStatus";
      }
    };
    exports2.ParameterStatusMessage = ParameterStatusMessage;
    var AuthenticationMD5Password = class {
      constructor(length, salt) {
        this.length = length;
        this.salt = salt;
        this.name = "authenticationMD5Password";
      }
    };
    exports2.AuthenticationMD5Password = AuthenticationMD5Password;
    var BackendKeyDataMessage = class {
      constructor(length, processID, secretKey) {
        this.length = length;
        this.processID = processID;
        this.secretKey = secretKey;
        this.name = "backendKeyData";
      }
    };
    exports2.BackendKeyDataMessage = BackendKeyDataMessage;
    var NotificationResponseMessage = class {
      constructor(length, processId, channel, payload) {
        this.length = length;
        this.processId = processId;
        this.channel = channel;
        this.payload = payload;
        this.name = "notification";
      }
    };
    exports2.NotificationResponseMessage = NotificationResponseMessage;
    var ReadyForQueryMessage = class {
      constructor(length, status) {
        this.length = length;
        this.status = status;
        this.name = "readyForQuery";
      }
    };
    exports2.ReadyForQueryMessage = ReadyForQueryMessage;
    var CommandCompleteMessage = class {
      constructor(length, text) {
        this.length = length;
        this.text = text;
        this.name = "commandComplete";
      }
    };
    exports2.CommandCompleteMessage = CommandCompleteMessage;
    var DataRowMessage = class {
      constructor(length, fields) {
        this.length = length;
        this.fields = fields;
        this.name = "dataRow";
        this.fieldCount = fields.length;
      }
    };
    exports2.DataRowMessage = DataRowMessage;
    var NoticeMessage = class {
      constructor(length, message) {
        this.length = length;
        this.message = message;
        this.name = "notice";
      }
    };
    exports2.NoticeMessage = NoticeMessage;
  }
});

// node_modules/.pnpm/pg-protocol@1.16.1/node_modules/pg-protocol/dist/buffer-writer.js
var require_buffer_writer = __commonJS({
  "node_modules/.pnpm/pg-protocol@1.16.1/node_modules/pg-protocol/dist/buffer-writer.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Writer = void 0;
    var Writer = class {
      constructor(size = 256) {
        this.size = size;
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(size);
      }
      ensure(size) {
        const remaining = this.buffer.length - this.offset;
        if (remaining < size) {
          const oldBuffer = this.buffer;
          const newSize = oldBuffer.length + (oldBuffer.length >> 1) + size;
          this.buffer = Buffer.allocUnsafe(newSize);
          oldBuffer.copy(this.buffer, 0, 0, this.offset);
        }
      }
      addInt32(num) {
        this.ensure(4);
        this.buffer[this.offset++] = num >>> 24 & 255;
        this.buffer[this.offset++] = num >>> 16 & 255;
        this.buffer[this.offset++] = num >>> 8 & 255;
        this.buffer[this.offset++] = num >>> 0 & 255;
        return this;
      }
      addInt16(num) {
        this.ensure(2);
        this.buffer[this.offset++] = num >>> 8 & 255;
        this.buffer[this.offset++] = num >>> 0 & 255;
        return this;
      }
      addCString(string) {
        if (!string) {
          this.ensure(1);
        } else {
          const len = Buffer.byteLength(string);
          this.ensure(len + 1);
          this.buffer.write(string, this.offset, "utf-8");
          this.offset += len;
        }
        this.buffer[this.offset++] = 0;
        return this;
      }
      addString(string = "") {
        const len = Buffer.byteLength(string);
        this.ensure(len);
        this.buffer.write(string, this.offset);
        this.offset += len;
        return this;
      }
      // Write an Int32 byte-length prefix immediately followed by the string's UTF-8
      // bytes. Postgres' Bind wire format prefixes every parameter with its length,
      // and doing it in one method computes Buffer.byteLength ONCE — the previous
      // `addInt32(Buffer.byteLength(s)).addString(s)` pairing scanned the string
      // three times (byteLength for the prefix, byteLength again inside addString,
      // then the encode), which is costly for large text parameters.
      addInt32PrefixedString(string) {
        const len = Buffer.byteLength(string);
        this.ensure(4 + len);
        const buffer = this.buffer;
        let offset = this.offset;
        buffer[offset++] = len >>> 24 & 255;
        buffer[offset++] = len >>> 16 & 255;
        buffer[offset++] = len >>> 8 & 255;
        buffer[offset++] = len >>> 0 & 255;
        buffer.write(string, offset, "utf-8");
        this.offset = offset + len;
        return this;
      }
      add(otherBuffer) {
        this.ensure(otherBuffer.length);
        otherBuffer.copy(this.buffer, this.offset);
        this.offset += otherBuffer.length;
        return this;
      }
      /**
       * Appends an uninitialized block of {@link size} bytes to the buffer and returns its offset.
       */
      reserveUnsafe(size) {
        const offset = this.offset;
        this.ensure(size);
        this.offset += size;
        return offset;
      }
      join(code) {
        if (code) {
          this.buffer[this.headerPosition] = code;
          const length = this.offset - (this.headerPosition + 1);
          this.buffer.writeInt32BE(length, this.headerPosition + 1);
        }
        return this.buffer.slice(code ? 0 : 5, this.offset);
      }
      flush(code) {
        const result = this.join(code);
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(this.size);
        return result;
      }
      clear() {
        this.offset = 5;
        this.headerPosition = 0;
      }
    };
    exports2.Writer = Writer;
  }
});

// node_modules/.pnpm/pg-protocol@1.16.1/node_modules/pg-protocol/dist/serializer.js
var require_serializer = __commonJS({
  "node_modules/.pnpm/pg-protocol@1.16.1/node_modules/pg-protocol/dist/serializer.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.serialize = void 0;
    var buffer_writer_1 = require_buffer_writer();
    var writer = new buffer_writer_1.Writer();
    var startup = (opts) => {
      writer.addInt16(3).addInt16(0);
      for (const key2 of Object.keys(opts)) {
        writer.addCString(key2).addCString(opts[key2]);
      }
      writer.addCString("client_encoding").addCString("UTF8");
      const bodyBuffer = writer.addCString("").flush();
      const length = bodyBuffer.length + 4;
      return new buffer_writer_1.Writer().addInt32(length).add(bodyBuffer).flush();
    };
    var requestSsl = () => {
      const response = Buffer.allocUnsafe(8);
      response.writeInt32BE(8, 0);
      response.writeInt32BE(80877103, 4);
      return response;
    };
    var password = (password2) => {
      return writer.addCString(password2).flush(
        112
        /* code.startup */
      );
    };
    var sendSASLInitialResponseMessage = function(mechanism, initialResponse) {
      writer.addCString(mechanism).addInt32PrefixedString(initialResponse);
      return writer.flush(
        112
        /* code.startup */
      );
    };
    var sendSCRAMClientFinalMessage = function(additionalData) {
      return writer.addString(additionalData).flush(
        112
        /* code.startup */
      );
    };
    var query = (text) => {
      return writer.addCString(text).flush(
        81
        /* code.query */
      );
    };
    var emptyArray = [];
    var parse = (query2) => {
      const name = query2.name || "";
      if (name.length > 63) {
        console.error("Warning! Postgres only supports 63 characters for query names.");
        console.error("You supplied %s (%s)", name, name.length);
        console.error("This can cause conflicts and silent errors executing queries");
      }
      const types2 = query2.types || emptyArray;
      const len = types2.length;
      const buffer = writer.addCString(name).addCString(query2.text).addInt16(len);
      for (let i = 0; i < len; i++) {
        buffer.addInt32(types2[i]);
      }
      return writer.flush(
        80
        /* code.parse */
      );
    };
    var writeValues = function(values, valueMapper, formatsOffset) {
      const len = values.length;
      for (let i = 0; i < len; i++) {
        const mappedVal = valueMapper ? valueMapper(values[i], i) : values[i];
        let formatByte = 0;
        if (mappedVal == null) {
          writer.addInt32(-1);
        } else if (mappedVal instanceof Buffer) {
          formatByte = 1;
          writer.addInt32(mappedVal.length);
          writer.add(mappedVal);
        } else {
          writer.addInt32PrefixedString(mappedVal);
        }
        const buf = writer.buffer;
        buf[formatsOffset++] = 0;
        buf[formatsOffset++] = formatByte;
      }
    };
    var bind = (config = {}) => {
      const portal = config.portal || "";
      const statement = config.statement || "";
      const binary = config.binary || false;
      const values = config.values || emptyArray;
      const len = values.length;
      writer.addCString(portal).addCString(statement);
      writer.addInt16(len);
      const formatsOffset = writer.reserveUnsafe(len * 2);
      writer.addInt16(len);
      try {
        writeValues(values, config.valueMapper, formatsOffset);
      } catch (err) {
        writer.clear();
        throw err;
      }
      writer.addInt16(1);
      writer.addInt16(
        binary ? 1 : 0
        /* ParamType.STRING */
      );
      return writer.flush(
        66
        /* code.bind */
      );
    };
    var emptyExecute = Buffer.from([69, 0, 0, 0, 9, 0, 0, 0, 0, 0]);
    var execute = (config) => {
      if (!config || !config.portal && !config.rows) {
        return emptyExecute;
      }
      const portal = config.portal || "";
      const rows = config.rows || 0;
      const portalLength = Buffer.byteLength(portal);
      const len = 4 + portalLength + 1 + 4;
      const buff = Buffer.allocUnsafe(1 + len);
      buff[0] = 69;
      buff.writeInt32BE(len, 1);
      buff.write(portal, 5, "utf-8");
      buff[portalLength + 5] = 0;
      buff.writeUInt32BE(rows, buff.length - 4);
      return buff;
    };
    var cancel = (processID, secretKey) => {
      const buffer = Buffer.allocUnsafe(16);
      buffer.writeInt32BE(16, 0);
      buffer.writeInt16BE(1234, 4);
      buffer.writeInt16BE(5678, 6);
      buffer.writeInt32BE(processID, 8);
      buffer.writeInt32BE(secretKey, 12);
      return buffer;
    };
    var cstringMessage = (code, string) => {
      const stringLen = Buffer.byteLength(string);
      const len = 4 + stringLen + 1;
      const buffer = Buffer.allocUnsafe(1 + len);
      buffer[0] = code;
      buffer.writeInt32BE(len, 1);
      buffer.write(string, 5, "utf-8");
      buffer[len] = 0;
      return buffer;
    };
    var emptyDescribePortal = writer.addCString("P").flush(
      68
      /* code.describe */
    );
    var emptyDescribeStatement = writer.addCString("S").flush(
      68
      /* code.describe */
    );
    var describe2 = (msg) => {
      return msg.name ? cstringMessage(68, `${msg.type}${msg.name || ""}`) : msg.type === "P" ? emptyDescribePortal : emptyDescribeStatement;
    };
    var close = (msg) => {
      const text = `${msg.type}${msg.name || ""}`;
      return cstringMessage(67, text);
    };
    var copyData = (chunk) => {
      return writer.add(chunk).flush(
        100
        /* code.copyFromChunk */
      );
    };
    var copyFail = (message) => {
      return cstringMessage(102, message);
    };
    var codeOnlyBuffer = (code) => Buffer.from([code, 0, 0, 0, 4]);
    var flushBuffer = codeOnlyBuffer(
      72
      /* code.flush */
    );
    var syncBuffer = codeOnlyBuffer(
      83
      /* code.sync */
    );
    var endBuffer = codeOnlyBuffer(
      88
      /* code.end */
    );
    var copyDoneBuffer = codeOnlyBuffer(
      99
      /* code.copyDone */
    );
    var serialize = {
      startup,
      password,
      requestSsl,
      sendSASLInitialResponseMessage,
      sendSCRAMClientFinalMessage,
      query,
      parse,
      bind,
      execute,
      describe: describe2,
      close,
      flush: () => flushBuffer,
      sync: () => syncBuffer,
      end: () => endBuffer,
      copyData,
      copyDone: () => copyDoneBuffer,
      copyFail,
      cancel
    };
    exports2.serialize = serialize;
  }
});

// node_modules/.pnpm/pg-protocol@1.16.1/node_modules/pg-protocol/dist/buffer-reader.js
var require_buffer_reader = __commonJS({
  "node_modules/.pnpm/pg-protocol@1.16.1/node_modules/pg-protocol/dist/buffer-reader.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.BufferReader = void 0;
    var BufferReader = class {
      constructor(offset = 0) {
        this.offset = offset;
        this.buffer = Buffer.allocUnsafe(0);
        this.encoding = "utf-8";
      }
      setBuffer(offset, buffer) {
        this.offset = offset;
        this.buffer = buffer;
      }
      int16() {
        const result = this.buffer.readInt16BE(this.offset);
        this.offset += 2;
        return result;
      }
      byte() {
        const result = this.buffer[this.offset];
        this.offset++;
        return result;
      }
      int32() {
        const result = this.buffer.readInt32BE(this.offset);
        this.offset += 4;
        return result;
      }
      uint32() {
        const result = this.buffer.readUInt32BE(this.offset);
        this.offset += 4;
        return result;
      }
      string(length) {
        const result = this.buffer.toString(this.encoding, this.offset, this.offset + length);
        this.offset += length;
        return result;
      }
      cstring() {
        const start = this.offset;
        let end = start;
        while (this.buffer[end++]) {
        }
        this.offset = end;
        return this.buffer.toString(this.encoding, start, end - 1);
      }
      bytes(length) {
        const result = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        return result;
      }
    };
    exports2.BufferReader = BufferReader;
  }
});

// node_modules/.pnpm/pg-protocol@1.16.1/node_modules/pg-protocol/dist/parser.js
var require_parser = __commonJS({
  "node_modules/.pnpm/pg-protocol@1.16.1/node_modules/pg-protocol/dist/parser.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Parser = void 0;
    var messages_1 = require_messages();
    var buffer_reader_1 = require_buffer_reader();
    var CODE_LENGTH = 1;
    var LEN_LENGTH = 4;
    var HEADER_LENGTH = CODE_LENGTH + LEN_LENGTH;
    var LATEINIT_LENGTH = -1;
    var emptyBuffer = Buffer.allocUnsafe(0);
    var Parser2 = class {
      constructor(opts) {
        this.buffer = emptyBuffer;
        this.bufferLength = 0;
        this.bufferOffset = 0;
        this.reader = new buffer_reader_1.BufferReader();
        if ((opts === null || opts === void 0 ? void 0 : opts.mode) === "binary") {
          throw new Error("Binary mode not supported yet");
        }
        this.mode = (opts === null || opts === void 0 ? void 0 : opts.mode) || "text";
      }
      parse(buffer, callback) {
        this.mergeBuffer(buffer);
        const bufferFullLength = this.bufferOffset + this.bufferLength;
        let offset = this.bufferOffset;
        while (offset + HEADER_LENGTH <= bufferFullLength) {
          const code = this.buffer[offset];
          const length = this.buffer.readUInt32BE(offset + CODE_LENGTH);
          const fullMessageLength = CODE_LENGTH + length;
          if (fullMessageLength + offset <= bufferFullLength) {
            const message = this.handlePacket(offset + HEADER_LENGTH, code, length, this.buffer);
            callback(message);
            offset += fullMessageLength;
          } else {
            break;
          }
        }
        if (offset === bufferFullLength) {
          this.buffer = emptyBuffer;
          this.bufferLength = 0;
          this.bufferOffset = 0;
        } else {
          this.bufferLength = bufferFullLength - offset;
          this.bufferOffset = offset;
        }
      }
      mergeBuffer(buffer) {
        if (this.bufferLength > 0) {
          const newLength = this.bufferLength + buffer.byteLength;
          const newFullLength = newLength + this.bufferOffset;
          if (newFullLength > this.buffer.byteLength) {
            let newBuffer;
            if (newLength <= this.buffer.byteLength && this.bufferOffset >= this.bufferLength) {
              newBuffer = this.buffer;
            } else {
              let newBufferLength = this.buffer.byteLength * 2;
              while (newLength >= newBufferLength) {
                newBufferLength *= 2;
              }
              newBuffer = Buffer.allocUnsafe(newBufferLength);
            }
            this.buffer.copy(newBuffer, 0, this.bufferOffset, this.bufferOffset + this.bufferLength);
            this.buffer = newBuffer;
            this.bufferOffset = 0;
          }
          buffer.copy(this.buffer, this.bufferOffset + this.bufferLength);
          this.bufferLength = newLength;
        } else {
          this.buffer = buffer;
          this.bufferOffset = 0;
          this.bufferLength = buffer.byteLength;
        }
      }
      handlePacket(offset, code, length, bytes) {
        const { reader } = this;
        reader.setBuffer(offset, bytes);
        let message;
        switch (code) {
          case 50:
            message = messages_1.bindComplete;
            break;
          case 49:
            message = messages_1.parseComplete;
            break;
          case 51:
            message = messages_1.closeComplete;
            break;
          case 110:
            message = messages_1.noData;
            break;
          case 115:
            message = messages_1.portalSuspended;
            break;
          case 99:
            message = messages_1.copyDone;
            break;
          case 87:
            message = messages_1.replicationStart;
            break;
          case 73:
            message = messages_1.emptyQuery;
            break;
          case 68:
            message = parseDataRowMessage(reader);
            break;
          case 67:
            message = parseCommandCompleteMessage(reader);
            break;
          case 90:
            message = parseReadyForQueryMessage(reader);
            break;
          case 65:
            message = parseNotificationMessage(reader);
            break;
          case 82:
            message = parseAuthenticationResponse(reader, length);
            break;
          case 83:
            message = parseParameterStatusMessage(reader);
            break;
          case 75:
            message = parseBackendKeyData(reader);
            break;
          case 69:
            message = parseErrorMessage(reader, "error");
            break;
          case 78:
            message = parseErrorMessage(reader, "notice");
            break;
          case 84:
            message = parseRowDescriptionMessage(reader);
            break;
          case 116:
            message = parseParameterDescriptionMessage(reader);
            break;
          case 71:
            message = parseCopyInMessage(reader);
            break;
          case 72:
            message = parseCopyOutMessage(reader);
            break;
          case 100:
            message = parseCopyData(reader, length);
            break;
          default:
            return new messages_1.DatabaseError("received invalid response: " + code.toString(16), length, "error");
        }
        reader.setBuffer(0, emptyBuffer);
        message.length = length;
        return message;
      }
    };
    exports2.Parser = Parser2;
    var parseReadyForQueryMessage = (reader) => {
      const status = reader.string(1);
      return new messages_1.ReadyForQueryMessage(LATEINIT_LENGTH, status);
    };
    var parseCommandCompleteMessage = (reader) => {
      const text = reader.cstring();
      return new messages_1.CommandCompleteMessage(LATEINIT_LENGTH, text);
    };
    var parseCopyData = (reader, length) => {
      const chunk = reader.bytes(length - 4);
      return new messages_1.CopyDataMessage(LATEINIT_LENGTH, chunk);
    };
    var parseCopyInMessage = (reader) => parseCopyMessage(reader, "copyInResponse");
    var parseCopyOutMessage = (reader) => parseCopyMessage(reader, "copyOutResponse");
    var parseCopyMessage = (reader, messageName) => {
      const isBinary = reader.byte() !== 0;
      const columnCount = reader.int16();
      const message = new messages_1.CopyResponse(LATEINIT_LENGTH, messageName, isBinary, columnCount);
      for (let i = 0; i < columnCount; i++) {
        message.columnTypes[i] = reader.int16();
      }
      return message;
    };
    var parseNotificationMessage = (reader) => {
      const processId = reader.int32();
      const channel = reader.cstring();
      const payload = reader.cstring();
      return new messages_1.NotificationResponseMessage(LATEINIT_LENGTH, processId, channel, payload);
    };
    var parseRowDescriptionMessage = (reader) => {
      const fieldCount = reader.int16();
      const message = new messages_1.RowDescriptionMessage(LATEINIT_LENGTH, fieldCount);
      for (let i = 0; i < fieldCount; i++) {
        message.fields[i] = parseField(reader);
      }
      return message;
    };
    var parseField = (reader) => {
      const name = reader.cstring();
      const tableID = reader.uint32();
      const columnID = reader.int16();
      const dataTypeID = reader.uint32();
      const dataTypeSize = reader.int16();
      const dataTypeModifier = reader.int32();
      const mode = reader.int16() === 0 ? "text" : "binary";
      return new messages_1.Field(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, mode);
    };
    var parseParameterDescriptionMessage = (reader) => {
      const parameterCount = reader.int16();
      const message = new messages_1.ParameterDescriptionMessage(LATEINIT_LENGTH, parameterCount);
      for (let i = 0; i < parameterCount; i++) {
        message.dataTypeIDs[i] = reader.uint32();
      }
      return message;
    };
    var parseDataRowMessage = (reader) => {
      const fieldCount = reader.int16();
      const fields = new Array(fieldCount);
      for (let i = 0; i < fieldCount; i++) {
        const len = reader.int32();
        fields[i] = len === -1 ? null : reader.string(len);
      }
      return new messages_1.DataRowMessage(LATEINIT_LENGTH, fields);
    };
    var parseParameterStatusMessage = (reader) => {
      const name = reader.cstring();
      const value = reader.cstring();
      return new messages_1.ParameterStatusMessage(LATEINIT_LENGTH, name, value);
    };
    var parseBackendKeyData = (reader) => {
      const processID = reader.int32();
      const secretKey = reader.int32();
      return new messages_1.BackendKeyDataMessage(LATEINIT_LENGTH, processID, secretKey);
    };
    var parseAuthenticationResponse = (reader, length) => {
      const code = reader.int32();
      const message = {
        name: "authenticationOk",
        length
      };
      switch (code) {
        case 0:
          break;
        case 3:
          if (message.length === 8) {
            message.name = "authenticationCleartextPassword";
          }
          break;
        case 5:
          if (message.length === 12) {
            message.name = "authenticationMD5Password";
            const salt = reader.bytes(4);
            return new messages_1.AuthenticationMD5Password(LATEINIT_LENGTH, salt);
          }
          break;
        case 10:
          {
            message.name = "authenticationSASL";
            message.mechanisms = [];
            let mechanism;
            do {
              mechanism = reader.cstring();
              if (mechanism) {
                message.mechanisms.push(mechanism);
              }
            } while (mechanism);
          }
          break;
        case 11:
          message.name = "authenticationSASLContinue";
          message.data = reader.string(length - 8);
          break;
        case 12:
          message.name = "authenticationSASLFinal";
          message.data = reader.string(length - 8);
          break;
        default:
          throw new Error("Unknown authenticationOk message type " + code);
      }
      return message;
    };
    var parseErrorMessage = (reader, name) => {
      const fields = {};
      let fieldType = reader.string(1);
      while (fieldType !== "\0") {
        fields[fieldType] = reader.cstring();
        fieldType = reader.string(1);
      }
      const messageValue = fields.M;
      const message = name === "notice" ? new messages_1.NoticeMessage(LATEINIT_LENGTH, messageValue) : new messages_1.DatabaseError(messageValue, LATEINIT_LENGTH, name);
      message.severity = fields.S;
      message.code = fields.C;
      message.detail = fields.D;
      message.hint = fields.H;
      message.position = fields.P;
      message.internalPosition = fields.p;
      message.internalQuery = fields.q;
      message.where = fields.W;
      message.schema = fields.s;
      message.table = fields.t;
      message.column = fields.c;
      message.dataType = fields.d;
      message.constraint = fields.n;
      message.file = fields.F;
      message.line = fields.L;
      message.routine = fields.R;
      return message;
    };
  }
});

// node_modules/.pnpm/pg-protocol@1.16.1/node_modules/pg-protocol/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/pg-protocol@1.16.1/node_modules/pg-protocol/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DatabaseError = exports2.serialize = void 0;
    exports2.parse = parse;
    var messages_1 = require_messages();
    Object.defineProperty(exports2, "DatabaseError", { enumerable: true, get: function() {
      return messages_1.DatabaseError;
    } });
    var serializer_1 = require_serializer();
    Object.defineProperty(exports2, "serialize", { enumerable: true, get: function() {
      return serializer_1.serialize;
    } });
    var parser_1 = require_parser();
    function parse(stream, callback) {
      const parser = new parser_1.Parser();
      stream.on("data", (buffer) => parser.parse(buffer, callback));
      return new Promise((resolve4) => stream.on("end", () => resolve4()));
    }
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/stream.js
var require_stream = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/stream.js"(exports2, module2) {
    var { getStream, getSecureStream } = getStreamFuncs();
    module2.exports = {
      /**
       * Get a socket stream compatible with the current runtime environment.
       * @returns {Duplex}
       */
      getStream,
      /**
       * Get a TLS secured socket, compatible with the current environment,
       * using the socket and other settings given in `options`.
       * @returns {Duplex}
       */
      getSecureStream
    };
    function getNodejsStreamFuncs() {
      function getStream2(ssl) {
        const net = require("net");
        return new net.Socket();
      }
      function getSecureStream2(options) {
        const tls = require("tls");
        return tls.connect(options);
      }
      return {
        getStream: getStream2,
        getSecureStream: getSecureStream2
      };
    }
    function getCloudflareStreamFuncs() {
      function getStream2(ssl) {
        const { CloudflareSocket } = require("pg-cloudflare");
        return new CloudflareSocket(ssl);
      }
      function getSecureStream2(options) {
        options.socket.startTls(options);
        return options.socket;
      }
      return {
        getStream: getStream2,
        getSecureStream: getSecureStream2
      };
    }
    function isCloudflareRuntime() {
      if (typeof navigator === "object" && navigator !== null && typeof navigator.userAgent === "string") {
        return navigator.userAgent === "Cloudflare-Workers";
      }
      if (typeof Response === "function") {
        const resp = new Response(null, { cf: { thing: true } });
        if (typeof resp.cf === "object" && resp.cf !== null && resp.cf.thing) {
          return true;
        }
      }
      return false;
    }
    function getStreamFuncs() {
      if (isCloudflareRuntime()) {
        return getCloudflareStreamFuncs();
      }
      return getNodejsStreamFuncs();
    }
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/connection.js
var require_connection = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/connection.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events").EventEmitter;
    var { parse, serialize } = require_dist();
    var stream = require_stream();
    var { getStream } = stream;
    var flushBuffer = serialize.flush();
    var syncBuffer = serialize.sync();
    var endBuffer = serialize.end();
    var Connection2 = class extends EventEmitter {
      constructor(config) {
        super();
        config = config || {};
        this.stream = config.stream || getStream(config.ssl);
        if (typeof this.stream === "function") {
          this.stream = this.stream(config);
        }
        this._keepAlive = config.keepAlive;
        this._keepAliveInitialDelayMillis = config.keepAliveInitialDelayMillis;
        this.parsedStatements = {};
        this.submittedNamedStatements = {};
        this.ssl = config.ssl || false;
        this.sslNegotiation = config.sslNegotiation || "postgres";
        this._ending = false;
        this._emitMessage = false;
        const self = this;
        this.on("newListener", function(eventName) {
          if (eventName === "message") {
            self._emitMessage = true;
          }
        });
      }
      connect(port, host) {
        const self = this;
        this._connecting = true;
        this.stream.setNoDelay(true);
        this.stream.connect(port, host);
        this.stream.once("connect", function() {
          if (self._keepAlive) {
            self.stream.setKeepAlive(true, self._keepAliveInitialDelayMillis);
          }
          self.emit("connect");
        });
        const reportStreamError = function(error) {
          if (self._ending && (error.code === "ECONNRESET" || error.code === "EPIPE")) {
            return;
          }
          self.emit("error", error);
        };
        this.stream.on("error", reportStreamError);
        this.stream.on("close", function() {
          self.emit("end");
        });
        if (!this.ssl) {
          return this.attachListeners(this.stream);
        }
        if (this.sslNegotiation === "direct") {
          return this.stream.once("connect", function() {
            self.upgradeToSSL(host, reportStreamError);
          });
        }
        this.stream.once("data", function(buffer) {
          const responseCode = buffer.toString("utf8");
          switch (responseCode) {
            case "S":
              break;
            case "N":
              self.stream.end();
              return self.emit("error", new Error("The server does not support SSL connections"));
            default:
              self.stream.end();
              return self.emit("error", new Error("There was an error establishing an SSL connection"));
          }
          self.upgradeToSSL(host, reportStreamError);
        });
      }
      upgradeToSSL(host, reportStreamError) {
        const self = this;
        const options = {
          socket: self.stream,
          // tls.connect checks the server identity against `servername`, falling
          // back to `host` and then to 'localhost'. `servername` must stay unset
          // for IP addresses (see below), so `host` is needed to keep certificate
          // validation working when connecting to an IP address.
          host
        };
        if (self.ssl !== true) {
          Object.assign(options, self.ssl);
          if ("key" in self.ssl) {
            options.key = self.ssl.key;
          }
        }
        if (self.sslNegotiation === "direct") {
          options.ALPNProtocols = ["postgresql"];
        }
        const net = require("net");
        if (net.isIP && net.isIP(host) === 0) {
          options.servername = host;
        }
        try {
          self.stream = stream.getSecureStream(options);
        } catch (err) {
          return self.emit("error", err);
        }
        self.attachListeners(self.stream);
        self.stream.on("error", reportStreamError);
        self.emit("sslconnect");
      }
      attachListeners(stream2) {
        parse(stream2, (msg) => {
          const eventName = msg.name === "error" ? "errorMessage" : msg.name;
          if (this._emitMessage) {
            this.emit("message", msg);
          }
          this.emit(eventName, msg);
        });
      }
      requestSsl() {
        this.stream.write(serialize.requestSsl());
      }
      startup(config) {
        this.stream.write(serialize.startup(config));
      }
      cancel(processID, secretKey) {
        this._send(serialize.cancel(processID, secretKey));
      }
      password(password) {
        this._send(serialize.password(password));
      }
      sendSASLInitialResponseMessage(mechanism, initialResponse) {
        this._send(serialize.sendSASLInitialResponseMessage(mechanism, initialResponse));
      }
      sendSCRAMClientFinalMessage(additionalData) {
        this._send(serialize.sendSCRAMClientFinalMessage(additionalData));
      }
      _send(buffer) {
        if (!this.stream.writable) {
          return false;
        }
        return this.stream.write(buffer);
      }
      query(text) {
        this._send(serialize.query(text));
      }
      // send parse message
      parse(query) {
        this._send(serialize.parse(query));
      }
      // send bind message
      bind(config) {
        this._send(serialize.bind(config));
      }
      // send execute message
      execute(config) {
        this._send(serialize.execute(config));
      }
      flush() {
        if (this.stream.writable) {
          this.stream.write(flushBuffer);
        }
      }
      sync() {
        this._send(syncBuffer);
      }
      ref() {
        this.stream.ref();
      }
      unref() {
        this.stream.unref();
      }
      end() {
        this._ending = true;
        if (!this._connecting || !this.stream.writable) {
          this.stream.end();
          return;
        }
        return this.stream.write(endBuffer, () => {
          this.stream.end();
        });
      }
      close(msg) {
        this._send(serialize.close(msg));
      }
      describe(msg) {
        this._send(serialize.describe(msg));
      }
      sendCopyFromChunk(chunk) {
        this._send(serialize.copyData(chunk));
      }
      endCopyFrom() {
        this._send(serialize.copyDone());
      }
      sendCopyFail(msg) {
        this._send(serialize.copyFail(msg));
      }
    };
    module2.exports = Connection2;
  }
});

// node_modules/.pnpm/split2@4.2.0/node_modules/split2/index.js
var require_split2 = __commonJS({
  "node_modules/.pnpm/split2@4.2.0/node_modules/split2/index.js"(exports2, module2) {
    "use strict";
    var { Transform } = require("stream");
    var { StringDecoder } = require("string_decoder");
    var kLast = /* @__PURE__ */ Symbol("last");
    var kDecoder = /* @__PURE__ */ Symbol("decoder");
    function transform(chunk, enc, cb) {
      let list;
      if (this.overflow) {
        const buf = this[kDecoder].write(chunk);
        list = buf.split(this.matcher);
        if (list.length === 1) return cb();
        list.shift();
        this.overflow = false;
      } else {
        this[kLast] += this[kDecoder].write(chunk);
        list = this[kLast].split(this.matcher);
      }
      this[kLast] = list.pop();
      for (let i = 0; i < list.length; i++) {
        try {
          push(this, this.mapper(list[i]));
        } catch (error) {
          return cb(error);
        }
      }
      this.overflow = this[kLast].length > this.maxLength;
      if (this.overflow && !this.skipOverflow) {
        cb(new Error("maximum buffer reached"));
        return;
      }
      cb();
    }
    function flush(cb) {
      this[kLast] += this[kDecoder].end();
      if (this[kLast]) {
        try {
          push(this, this.mapper(this[kLast]));
        } catch (error) {
          return cb(error);
        }
      }
      cb();
    }
    function push(self, val) {
      if (val !== void 0) {
        self.push(val);
      }
    }
    function noop(incoming) {
      return incoming;
    }
    function split(matcher, mapper, options) {
      matcher = matcher || /\r?\n/;
      mapper = mapper || noop;
      options = options || {};
      switch (arguments.length) {
        case 1:
          if (typeof matcher === "function") {
            mapper = matcher;
            matcher = /\r?\n/;
          } else if (typeof matcher === "object" && !(matcher instanceof RegExp) && !matcher[Symbol.split]) {
            options = matcher;
            matcher = /\r?\n/;
          }
          break;
        case 2:
          if (typeof matcher === "function") {
            options = mapper;
            mapper = matcher;
            matcher = /\r?\n/;
          } else if (typeof mapper === "object") {
            options = mapper;
            mapper = noop;
          }
      }
      options = Object.assign({}, options);
      options.autoDestroy = true;
      options.transform = transform;
      options.flush = flush;
      options.readableObjectMode = true;
      const stream = new Transform(options);
      stream[kLast] = "";
      stream[kDecoder] = new StringDecoder("utf8");
      stream.matcher = matcher;
      stream.mapper = mapper;
      stream.maxLength = options.maxLength;
      stream.skipOverflow = options.skipOverflow || false;
      stream.overflow = false;
      stream._destroy = function(err, cb) {
        this._writableState.errorEmitted = false;
        cb(err);
      };
      return stream;
    }
    module2.exports = split;
  }
});

// node_modules/.pnpm/pgpass@1.0.5/node_modules/pgpass/lib/helper.js
var require_helper = __commonJS({
  "node_modules/.pnpm/pgpass@1.0.5/node_modules/pgpass/lib/helper.js"(exports2, module2) {
    "use strict";
    var path = require("path");
    var Stream = require("stream").Stream;
    var split = require_split2();
    var util = require("util");
    var defaultPort = 5432;
    var isWin = process.platform === "win32";
    var warnStream = process.stderr;
    var S_IRWXG = 56;
    var S_IRWXO = 7;
    var S_IFMT = 61440;
    var S_IFREG = 32768;
    function isRegFile(mode) {
      return (mode & S_IFMT) == S_IFREG;
    }
    var fieldNames = ["host", "port", "database", "user", "password"];
    var nrOfFields = fieldNames.length;
    var passKey = fieldNames[nrOfFields - 1];
    function warn() {
      var isWritable = warnStream instanceof Stream && true === warnStream.writable;
      if (isWritable) {
        var args = Array.prototype.slice.call(arguments).concat("\n");
        warnStream.write(util.format.apply(util, args));
      }
    }
    Object.defineProperty(module2.exports, "isWin", {
      get: function() {
        return isWin;
      },
      set: function(val) {
        isWin = val;
      }
    });
    module2.exports.warnTo = function(stream) {
      var old = warnStream;
      warnStream = stream;
      return old;
    };
    module2.exports.getFileName = function(rawEnv) {
      var env = rawEnv || process.env;
      var file = env.PGPASSFILE || (isWin ? path.join(env.APPDATA || "./", "postgresql", "pgpass.conf") : path.join(env.HOME || "./", ".pgpass"));
      return file;
    };
    module2.exports.usePgPass = function(stats, fname) {
      if (Object.prototype.hasOwnProperty.call(process.env, "PGPASSWORD")) {
        return false;
      }
      if (isWin) {
        return true;
      }
      fname = fname || "<unkn>";
      if (!isRegFile(stats.mode)) {
        warn('WARNING: password file "%s" is not a plain file', fname);
        return false;
      }
      if (stats.mode & (S_IRWXG | S_IRWXO)) {
        warn('WARNING: password file "%s" has group or world access; permissions should be u=rw (0600) or less', fname);
        return false;
      }
      return true;
    };
    var matcher = module2.exports.match = function(connInfo, entry) {
      return fieldNames.slice(0, -1).reduce(function(prev, field, idx) {
        if (idx == 1) {
          if (Number(connInfo[field] || defaultPort) === Number(entry[field])) {
            return prev && true;
          }
        }
        return prev && (entry[field] === "*" || entry[field] === connInfo[field]);
      }, true);
    };
    module2.exports.getPassword = function(connInfo, stream, cb) {
      var pass;
      var lineStream = stream.pipe(split());
      function onLine(line) {
        var entry = parseLine(line);
        if (entry && isValidEntry(entry) && matcher(connInfo, entry)) {
          pass = entry[passKey];
          lineStream.end();
        }
      }
      var onEnd = function() {
        stream.destroy();
        cb(pass);
      };
      var onErr = function(err) {
        stream.destroy();
        warn("WARNING: error on reading file: %s", err);
        cb(void 0);
      };
      stream.on("error", onErr);
      lineStream.on("data", onLine).on("end", onEnd).on("error", onErr);
    };
    var parseLine = module2.exports.parseLine = function(line) {
      if (line.length < 11 || line.match(/^\s+#/)) {
        return null;
      }
      var curChar = "";
      var prevChar = "";
      var fieldIdx = 0;
      var startIdx = 0;
      var endIdx = 0;
      var obj2 = {};
      var isLastField = false;
      var addToObj = function(idx, i0, i1) {
        var field = line.substring(i0, i1);
        if (!Object.hasOwnProperty.call(process.env, "PGPASS_NO_DEESCAPE")) {
          field = field.replace(/\\([:\\])/g, "$1");
        }
        obj2[fieldNames[idx]] = field;
      };
      for (var i = 0; i < line.length - 1; i += 1) {
        curChar = line.charAt(i + 1);
        prevChar = line.charAt(i);
        isLastField = fieldIdx == nrOfFields - 1;
        if (isLastField) {
          addToObj(fieldIdx, startIdx);
          break;
        }
        if (i >= 0 && curChar == ":" && prevChar !== "\\") {
          addToObj(fieldIdx, startIdx, i + 1);
          startIdx = i + 2;
          fieldIdx += 1;
        }
      }
      obj2 = Object.keys(obj2).length === nrOfFields ? obj2 : null;
      return obj2;
    };
    var isValidEntry = module2.exports.isValidEntry = function(entry) {
      var rules = {
        // host
        0: function(x) {
          return x.length > 0;
        },
        // port
        1: function(x) {
          if (x === "*") {
            return true;
          }
          x = Number(x);
          return isFinite(x) && x > 0 && x < 9007199254740992 && Math.floor(x) === x;
        },
        // database
        2: function(x) {
          return x.length > 0;
        },
        // username
        3: function(x) {
          return x.length > 0;
        },
        // password
        4: function(x) {
          return x.length > 0;
        }
      };
      for (var idx = 0; idx < fieldNames.length; idx += 1) {
        var rule = rules[idx];
        var value = entry[fieldNames[idx]] || "";
        var res = rule(value);
        if (!res) {
          return false;
        }
      }
      return true;
    };
  }
});

// node_modules/.pnpm/pgpass@1.0.5/node_modules/pgpass/lib/index.js
var require_lib = __commonJS({
  "node_modules/.pnpm/pgpass@1.0.5/node_modules/pgpass/lib/index.js"(exports2, module2) {
    "use strict";
    var path = require("path");
    var fs = require("fs");
    var helper = require_helper();
    module2.exports = function(connInfo, cb) {
      var file = helper.getFileName();
      fs.stat(file, function(err, stat) {
        if (err || !helper.usePgPass(stat, file)) {
          return cb(void 0);
        }
        var st = fs.createReadStream(file);
        helper.getPassword(connInfo, st, cb);
      });
    };
    module2.exports.warnTo = helper.warnTo;
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/client.js
var require_client = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/client.js"(exports2, module2) {
    var EventEmitter = require("events").EventEmitter;
    var utils = require_utils();
    var nodeUtils = require("util");
    var sasl = require_sasl();
    var TypeOverrides2 = require_type_overrides();
    var ConnectionParameters = require_connection_parameters();
    var Query2 = require_query();
    var defaults2 = require_defaults();
    var Connection2 = require_connection();
    var crypto = require_utils2();
    var activeQueryDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Client.activeQuery is deprecated and will be removed in pg@9.0"
    );
    var queryQueueDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Client.queryQueue is deprecated and will be removed in pg@9.0."
    );
    var pgPassDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "pgpass support is deprecated and will be removed in pg@9.0. You can provide an async function as the password property to the Client/Pool constructor that returns a password instead. Within this function you can call the pgpass module in your own code."
    );
    var byoPromiseDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Passing a custom Promise implementation to the Client/Pool constructor is deprecated and will be removed in pg@9.0."
    );
    var queryQueueLengthDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead."
    );
    function coerceNumberOrDefault(value, defaultValue) {
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : defaultValue;
      }
      if (typeof value === "string" && value.trim() !== "") {
        const n = Number(value);
        return Number.isFinite(n) ? n : defaultValue;
      }
      return defaultValue;
    }
    var Client2 = class extends EventEmitter {
      constructor(config) {
        super();
        this.connectionParameters = new ConnectionParameters(config);
        this.user = this.connectionParameters.user;
        this.database = this.connectionParameters.database;
        this.port = this.connectionParameters.port;
        this.host = this.connectionParameters.host;
        Object.defineProperty(this, "password", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: this.connectionParameters.password
        });
        this.replication = this.connectionParameters.replication;
        const c = config || {};
        if (c.Promise) {
          byoPromiseDeprecationNotice();
        }
        this._Promise = c.Promise || global.Promise;
        this._types = new TypeOverrides2(c.types);
        this._ending = false;
        this._ended = false;
        this._connecting = false;
        this._connected = false;
        this._connectionError = false;
        this._queryable = true;
        this._activeQuery = null;
        this._txStatus = null;
        this.enableChannelBinding = Boolean(c.enableChannelBinding);
        this.scramMaxIterations = coerceNumberOrDefault(c.scramMaxIterations, sasl.DEFAULT_MAX_SCRAM_ITERATIONS);
        this.connection = c.connection || new Connection2({
          stream: c.stream,
          ssl: this.connectionParameters.ssl,
          sslNegotiation: this.connectionParameters.sslnegotiation,
          keepAlive: c.keepAlive || false,
          keepAliveInitialDelayMillis: c.keepAliveInitialDelayMillis || 0,
          encoding: this.connectionParameters.client_encoding || "utf8"
        });
        this._queryQueue = [];
        this._sentQueryQueue = [];
        this.pipeline = Boolean(c.pipeline);
        this.binary = c.binary || defaults2.binary;
        this.processID = null;
        this.secretKey = null;
        this.ssl = this.connectionParameters.ssl || false;
        this.sslNegotiation = this.connectionParameters.sslnegotiation || "postgres";
        if (this.ssl && this.ssl.key) {
          Object.defineProperty(this.ssl, "key", {
            enumerable: false
          });
        }
        this._connectionTimeoutMillis = c.connectionTimeoutMillis || 0;
      }
      get activeQuery() {
        activeQueryDeprecationNotice();
        return this._activeQuery;
      }
      set activeQuery(val) {
        activeQueryDeprecationNotice();
        this._activeQuery = val;
      }
      _getActiveQuery() {
        return this._activeQuery;
      }
      _errorAllQueries(err) {
        const enqueueError = (query) => {
          process.nextTick(() => {
            query.handleError(err, this.connection);
          });
        };
        const activeQuery = this._getActiveQuery();
        if (activeQuery) {
          enqueueError(activeQuery);
          this._activeQuery = null;
        }
        this._sentQueryQueue.forEach(enqueueError);
        this._sentQueryQueue.length = 0;
        this._queryQueue.forEach(enqueueError);
        this._queryQueue.length = 0;
      }
      _connect(callback) {
        const self = this;
        const con = this.connection;
        this._connectionCallback = callback;
        if (this._connecting || this._connected) {
          const err = new Error("Client has already been connected. You cannot reuse a client.");
          process.nextTick(() => {
            callback(err);
          });
          return;
        }
        this._connecting = true;
        if (this._connectionTimeoutMillis > 0) {
          this.connectionTimeoutHandle = setTimeout(() => {
            con._ending = true;
            con.stream.destroy(new Error("timeout expired"));
          }, this._connectionTimeoutMillis);
          if (this.connectionTimeoutHandle.unref) {
            this.connectionTimeoutHandle.unref();
          }
        }
        if (this.host && this.host.indexOf("/") === 0) {
          con.connect(this.host + "/.s.PGSQL." + this.port);
        } else {
          con.connect(this.port, this.host);
        }
        con.on("connect", function() {
          if (self.ssl) {
            if (self.sslNegotiation !== "direct") {
              con.requestSsl();
            }
          } else {
            con.startup(self.getStartupConf());
          }
        });
        con.on("sslconnect", function() {
          con.startup(self.getStartupConf());
        });
        this._attachListeners(con);
        con.once("end", () => {
          const error = this._ending ? new Error("Connection terminated") : new Error("Connection terminated unexpectedly");
          clearTimeout(this.connectionTimeoutHandle);
          this._errorAllQueries(error);
          this._ended = true;
          if (!this._ending) {
            if (this._connecting && !this._connectionError) {
              if (this._connectionCallback) {
                this._connectionCallback(error);
              } else {
                this._handleErrorEvent(error);
              }
            } else if (!this._connectionError) {
              this._handleErrorEvent(error);
            }
          }
          process.nextTick(() => {
            this.emit("end");
          });
        });
      }
      connect(callback) {
        if (callback) {
          this._connect(callback);
          return;
        }
        return new this._Promise((resolve4, reject) => {
          this._connect((error) => {
            if (error) {
              reject(error);
            } else {
              resolve4(this);
            }
          });
        });
      }
      _attachListeners(con) {
        con.on("authenticationCleartextPassword", this._handleAuthCleartextPassword.bind(this));
        con.on("authenticationMD5Password", this._handleAuthMD5Password.bind(this));
        con.on("authenticationSASL", this._handleAuthSASL.bind(this));
        con.on("authenticationSASLContinue", this._handleAuthSASLContinue.bind(this));
        con.on("authenticationSASLFinal", this._handleAuthSASLFinal.bind(this));
        con.on("backendKeyData", this._handleBackendKeyData.bind(this));
        con.on("error", this._handleErrorEvent.bind(this));
        con.on("errorMessage", this._handleErrorMessage.bind(this));
        con.on("readyForQuery", this._handleReadyForQuery.bind(this));
        con.on("notice", this._handleNotice.bind(this));
        con.on("rowDescription", this._handleRowDescription.bind(this));
        con.on("dataRow", this._handleDataRow.bind(this));
        con.on("portalSuspended", this._handlePortalSuspended.bind(this));
        con.on("emptyQuery", this._handleEmptyQuery.bind(this));
        con.on("commandComplete", this._handleCommandComplete.bind(this));
        con.on("parseComplete", this._handleParseComplete.bind(this));
        con.on("copyInResponse", this._handleCopyInResponse.bind(this));
        con.on("copyData", this._handleCopyData.bind(this));
        con.on("notification", this._handleNotification.bind(this));
      }
      _getPassword(cb) {
        const con = this.connection;
        if (typeof this.password === "function") {
          this._Promise.resolve().then(() => this.password(this.connectionParameters)).then((pass) => {
            if (pass !== void 0) {
              if (typeof pass !== "string") {
                con.emit("error", new TypeError("Password must be a string"));
                return;
              }
              this.connectionParameters.password = this.password = pass;
            } else {
              this.connectionParameters.password = this.password = null;
            }
            cb();
          }).catch((err) => {
            con.emit("error", err);
          });
        } else if (this.password !== null) {
          cb();
        } else {
          try {
            const pgPass = require_lib();
            pgPass(this.connectionParameters, (pass) => {
              if (void 0 !== pass) {
                pgPassDeprecationNotice();
                this.connectionParameters.password = this.password = pass;
              }
              cb();
            });
          } catch (e) {
            this.emit("error", e);
          }
        }
      }
      _handleAuthCleartextPassword(msg) {
        this._getPassword(() => {
          this.connection.password(this.password);
        });
      }
      _handleAuthMD5Password(msg) {
        this._getPassword(async () => {
          try {
            const hashedPassword = await crypto.postgresMd5PasswordHash(this.user, this.password, msg.salt);
            this.connection.password(hashedPassword);
          } catch (e) {
            this.emit("error", e);
          }
        });
      }
      _handleAuthSASL(msg) {
        this._getPassword(() => {
          try {
            this.saslSession = sasl.startSession(
              msg.mechanisms,
              this.enableChannelBinding && this.connection.stream,
              this.scramMaxIterations
            );
            this.connection.sendSASLInitialResponseMessage(this.saslSession.mechanism, this.saslSession.response);
          } catch (err) {
            this.connection.emit("error", err);
          }
        });
      }
      async _handleAuthSASLContinue(msg) {
        try {
          await sasl.continueSession(
            this.saslSession,
            this.password,
            msg.data,
            this.enableChannelBinding && this.connection.stream
          );
          this.connection.sendSCRAMClientFinalMessage(this.saslSession.response);
        } catch (err) {
          this.connection.emit("error", err);
        }
      }
      _handleAuthSASLFinal(msg) {
        try {
          sasl.finalizeSession(this.saslSession, msg.data);
          this.saslSession = null;
        } catch (err) {
          this.connection.emit("error", err);
        }
      }
      _handleBackendKeyData(msg) {
        this.processID = msg.processID;
        this.secretKey = msg.secretKey;
      }
      _handleReadyForQuery(msg) {
        if (this._connecting) {
          this._connecting = false;
          this._connected = true;
          clearTimeout(this.connectionTimeoutHandle);
          if (this._connectionCallback) {
            this._connectionCallback(null, this);
            this._connectionCallback = null;
          }
          this.emit("connect");
        }
        const activeQuery = this._getActiveQuery();
        this._activeQuery = null;
        this._txStatus = msg?.status ?? null;
        this.readyForQuery = true;
        if (activeQuery) {
          activeQuery.handleReadyForQuery(this.connection);
        }
        this._pulseQueryQueue();
      }
      // if we receive an error event or error message
      // during the connection process we handle it here
      _handleErrorWhileConnecting(err) {
        if (this._connectionError) {
          return;
        }
        this._connectionError = true;
        clearTimeout(this.connectionTimeoutHandle);
        if (this._connectionCallback) {
          return this._connectionCallback(err);
        }
        this.emit("error", err);
      }
      // if we're connected and we receive an error event from the connection
      // this means the socket is dead - do a hard abort of all queries and emit
      // the socket error on the client as well
      _handleErrorEvent(err) {
        if (this._connecting) {
          return this._handleErrorWhileConnecting(err);
        }
        this._queryable = false;
        this._errorAllQueries(err);
        this.emit("error", err);
      }
      // handle error messages from the postgres backend
      _handleErrorMessage(msg) {
        if (this._connecting) {
          return this._handleErrorWhileConnecting(msg);
        }
        const activeQuery = this._getActiveQuery();
        if (!activeQuery) {
          this._handleErrorEvent(msg);
          return;
        }
        this._activeQuery = null;
        if (activeQuery.name) {
          delete this.connection.submittedNamedStatements[activeQuery.name];
        }
        activeQuery.handleError(msg, this.connection);
      }
      _handleRowDescription(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected rowDescription message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleRowDescription(msg);
      }
      _handleDataRow(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected dataRow message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleDataRow(msg);
      }
      _handlePortalSuspended(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected portalSuspended message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handlePortalSuspended(this.connection);
      }
      _handleEmptyQuery(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected emptyQuery message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleEmptyQuery(this.connection);
      }
      _handleCommandComplete(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected commandComplete message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCommandComplete(msg, this.connection);
      }
      _handleParseComplete() {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected parseComplete message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        if (activeQuery.name) {
          this.connection.parsedStatements[activeQuery.name] = activeQuery.text;
          delete this.connection.submittedNamedStatements[activeQuery.name];
        }
      }
      _handleCopyInResponse(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected copyInResponse message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCopyInResponse(this.connection);
      }
      _handleCopyData(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected copyData message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCopyData(msg, this.connection);
      }
      _handleNotification(msg) {
        this.emit("notification", msg);
      }
      _handleNotice(msg) {
        this.emit("notice", msg);
      }
      getStartupConf() {
        const params = this.connectionParameters;
        const data = {
          user: params.user,
          database: params.database
        };
        const appName = params.application_name || params.fallback_application_name;
        if (appName) {
          data.application_name = appName;
        }
        if (params.replication) {
          data.replication = "" + params.replication;
        }
        if (params.statement_timeout) {
          data.statement_timeout = String(parseInt(params.statement_timeout, 10));
        }
        if (params.lock_timeout) {
          data.lock_timeout = String(parseInt(params.lock_timeout, 10));
        }
        if (params.idle_in_transaction_session_timeout) {
          data.idle_in_transaction_session_timeout = String(parseInt(params.idle_in_transaction_session_timeout, 10));
        }
        if (params.options) {
          data.options = params.options;
        }
        return data;
      }
      cancel(client, query) {
        if (client.activeQuery === query) {
          const con = this.connection;
          if (this.host && this.host.indexOf("/") === 0) {
            con.connect(this.host + "/.s.PGSQL." + this.port);
          } else {
            con.connect(this.port, this.host);
          }
          con.on("connect", function() {
            con.cancel(client.processID, client.secretKey);
          });
        } else if (client._queryQueue.indexOf(query) !== -1) {
          client._queryQueue.splice(client._queryQueue.indexOf(query), 1);
        } else if (client._sentQueryQueue.indexOf(query) !== -1) {
          query.callback = () => {
          };
        }
      }
      setTypeParser(oid, format, parseFn) {
        return this._types.setTypeParser(oid, format, parseFn);
      }
      getTypeParser(oid, format) {
        return this._types.getTypeParser(oid, format);
      }
      // escapeIdentifier and escapeLiteral moved to utility functions & exported
      // on PG
      // re-exported here for backwards compatibility
      escapeIdentifier(str2) {
        return utils.escapeIdentifier(str2);
      }
      escapeLiteral(str2) {
        return utils.escapeLiteral(str2);
      }
      _pulseQueryQueue() {
        if (this.pipeline) {
          this._pulsePipelinedQueryQueue();
          return;
        }
        if (this.readyForQuery === true) {
          this._activeQuery = this._queryQueue.shift();
          const activeQuery = this._getActiveQuery();
          if (activeQuery) {
            this.readyForQuery = false;
            this.hasExecuted = true;
            const queryError = activeQuery.submit(this.connection);
            if (queryError) {
              process.nextTick(() => {
                activeQuery.handleError(queryError, this.connection);
                this.readyForQuery = true;
                this._pulseQueryQueue();
              });
            }
          } else if (this.hasExecuted) {
            this._activeQuery = null;
            this.emit("drain");
          }
        }
      }
      _pulsePipelinedQueryQueue() {
        if (!this._connected || !this._queryable) {
          return;
        }
        while (this._queryQueue.length > 0) {
          const query = this._queryQueue.shift();
          this.hasExecuted = true;
          const queryError = query.submit(this.connection);
          if (queryError) {
            process.nextTick(() => {
              query.handleError(queryError, this.connection);
            });
            continue;
          }
          this._sentQueryQueue.push(query);
        }
        if (this.readyForQuery && !this._activeQuery && this._sentQueryQueue.length > 0) {
          this._activeQuery = this._sentQueryQueue.shift();
          this.readyForQuery = false;
        }
        if (!this._activeQuery && this._sentQueryQueue.length === 0 && this._queryQueue.length === 0 && this.hasExecuted) {
          this.emit("drain");
        }
      }
      query(config, values, callback) {
        let query;
        let result;
        if (config == null) {
          throw new TypeError("Client was passed a null or undefined query");
        }
        if (typeof config.submit === "function") {
          result = query = config;
          if (!query.callback) {
            if (typeof values === "function") {
              query.callback = values;
            } else if (callback) {
              query.callback = callback;
            }
          }
        } else {
          query = new Query2(config, values, callback);
          if (!query.callback) {
            result = new this._Promise((resolve4, reject) => {
              query.callback = (err, res) => err ? reject(err) : resolve4(res);
            }).catch((err) => {
              Error.captureStackTrace(err);
              throw err;
            });
          } else if (typeof query.callback !== "function") {
            throw new TypeError("callback is not a function");
          }
        }
        const readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        if (readTimeout) {
          const queryCallback = query.callback || (() => {
          });
          const readTimeoutTimer = setTimeout(() => {
            const error = new Error("Query read timeout");
            process.nextTick(() => {
              query.handleError(error, this.connection);
            });
            queryCallback(error);
            query.callback = () => {
            };
            const index = this._queryQueue.indexOf(query);
            if (index > -1) {
              this._queryQueue.splice(index, 1);
            } else if (this.pipeline) {
              this.connection.stream.destroy();
              return;
            }
            this._pulseQueryQueue();
          }, readTimeout);
          query.callback = (err, res) => {
            clearTimeout(readTimeoutTimer);
            queryCallback(err, res);
          };
        }
        if (this.binary && !query.binary) {
          query.binary = true;
        }
        if (query._result && !query._result._types) {
          query._result._types = this._types;
        }
        if (this.pipeline) {
          const portalQuery = typeof config.submit === "function" && !(query instanceof Query2) ? "Custom query classes such as pg-cursor and pg-query-stream are" : query.rows ? "The `rows` option is" : null;
          if (portalQuery) {
            process.nextTick(() => {
              query.handleError(new Error(`${portalQuery} not supported in pipeline mode`), this.connection);
            });
            return result;
          }
        }
        if (!this._queryable) {
          process.nextTick(() => {
            query.handleError(new Error("Client has encountered a connection error and is not queryable"), this.connection);
          });
          return result;
        }
        if (this._ending) {
          process.nextTick(() => {
            query.handleError(new Error("Client was closed and is not queryable"), this.connection);
          });
          return result;
        }
        if (this._queryQueue.length > 0 && !this.pipeline) {
          queryQueueLengthDeprecationNotice();
        }
        this._queryQueue.push(query);
        this._pulseQueryQueue();
        return result;
      }
      ref() {
        this.connection.ref();
      }
      unref() {
        this.connection.unref();
      }
      getTransactionStatus() {
        return this._txStatus;
      }
      end(cb) {
        this._ending = true;
        if (!this.connection._connecting || this._ended) {
          if (cb) {
            cb();
            return;
          } else {
            return this._Promise.resolve();
          }
        }
        if (!this._queryable) {
          this.connection.stream.destroy();
        } else if (this.pipeline && (this._getActiveQuery() || this._sentQueryQueue.length > 0 || this._queryQueue.length > 0)) {
          this.once("drain", () => this.connection.end());
        } else if (this._getActiveQuery()) {
          this.connection.stream.destroy();
        } else {
          this.connection.end();
        }
        if (cb) {
          this.connection.once("end", cb);
        } else {
          return new this._Promise((resolve4) => {
            this.connection.once("end", resolve4);
          });
        }
      }
      get queryQueue() {
        queryQueueDeprecationNotice();
        return this._queryQueue;
      }
    };
    Client2.Query = Query2;
    module2.exports = Client2;
  }
});

// node_modules/.pnpm/pg-pool@3.14.0_pg@8.23.1/node_modules/pg-pool/index.js
var require_pg_pool = __commonJS({
  "node_modules/.pnpm/pg-pool@3.14.0_pg@8.23.1/node_modules/pg-pool/index.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events").EventEmitter;
    var NOOP = function() {
    };
    var removeWhere = (list, predicate) => {
      const i = list.findIndex(predicate);
      return i === -1 ? void 0 : list.splice(i, 1)[0];
    };
    var IdleItem = class {
      constructor(client, idleListener, timeoutId) {
        this.client = client;
        this.idleListener = idleListener;
        this.timeoutId = timeoutId;
      }
    };
    var PendingItem = class {
      constructor(callback) {
        this.callback = callback;
      }
    };
    function throwOnDoubleRelease() {
      throw new Error("Release called on client which has already been released to the pool.");
    }
    function promisify(Promise2, callback) {
      if (callback) {
        return { callback, result: void 0 };
      }
      let rej;
      let res;
      const cb = function(err, client) {
        err ? rej(err) : res(client);
      };
      const result = new Promise2(function(resolve4, reject) {
        res = resolve4;
        rej = reject;
      }).catch((err) => {
        Error.captureStackTrace(err);
        throw err;
      });
      return { callback: cb, result };
    }
    function makeIdleListener(pool, client) {
      return function idleListener(err) {
        err.client = client;
        client.removeListener("error", idleListener);
        client.on("error", () => {
          pool.log("additional client error after disconnection due to error", err);
        });
        pool._remove(client);
        pool.emit("error", err, client);
      };
    }
    var Pool2 = class extends EventEmitter {
      constructor(options, Client2) {
        super();
        this.options = Object.assign({}, options);
        if (options != null && "password" in options) {
          Object.defineProperty(this.options, "password", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: options.password
          });
        }
        if (options != null && options.ssl && options.ssl.key) {
          Object.defineProperty(this.options.ssl, "key", {
            enumerable: false
          });
        }
        this.options.max = this.options.max || this.options.poolSize || 10;
        this.options.min = this.options.min || 0;
        this.options.maxUses = this.options.maxUses || Infinity;
        this.options.allowExitOnIdle = this.options.allowExitOnIdle || false;
        this.options.maxLifetimeSeconds = this.options.maxLifetimeSeconds || 0;
        this.log = this.options.log || function() {
        };
        this.Client = this.options.Client || Client2 || require_lib2().Client;
        this.Promise = this.options.Promise || global.Promise;
        if (typeof this.options.idleTimeoutMillis === "undefined") {
          this.options.idleTimeoutMillis = 1e4;
        }
        this._clients = [];
        this._idle = [];
        this._expired = /* @__PURE__ */ new WeakSet();
        this._pendingQueue = [];
        this._endCallback = void 0;
        this.ending = false;
        this.ended = false;
      }
      _promiseTry(f) {
        const Promise2 = this.Promise;
        if (typeof Promise2.try === "function") {
          return Promise2.try(f);
        }
        return new Promise2((resolve4) => resolve4(f()));
      }
      _isFull() {
        return this._clients.length >= this.options.max;
      }
      _isAboveMin() {
        return this._clients.length > this.options.min;
      }
      _pulseQueue() {
        this.log("pulse queue");
        if (this.ended) {
          this.log("pulse queue ended");
          return;
        }
        if (this.ending) {
          this.log("pulse queue on ending");
          if (this._idle.length) {
            this._idle.slice().map((item) => {
              this._remove(item.client);
            });
          }
          if (!this._clients.length) {
            this.ended = true;
            this._endCallback();
          }
          return;
        }
        if (!this._pendingQueue.length) {
          this.log("no queued requests");
          return;
        }
        if (!this._idle.length && this._isFull()) {
          return;
        }
        const pendingItem = this._pendingQueue.shift();
        if (this._idle.length) {
          const idleItem = this._idle.pop();
          clearTimeout(idleItem.timeoutId);
          const client = idleItem.client;
          client.ref && client.ref();
          const idleListener = idleItem.idleListener;
          return this._acquireClient(client, pendingItem, idleListener, false);
        }
        if (!this._isFull()) {
          return this.newClient(pendingItem);
        }
        throw new Error("unexpected condition");
      }
      _remove(client, callback) {
        const removed = removeWhere(this._idle, (item) => item.client === client);
        if (removed !== void 0) {
          clearTimeout(removed.timeoutId);
        }
        this._clients = this._clients.filter((c) => c !== client);
        const context = this;
        client.end(() => {
          context.emit("remove", client);
          if (typeof callback === "function") {
            callback();
          }
        });
      }
      connect(cb) {
        if (this.ending) {
          const err = new Error("Cannot use a pool after calling end on the pool");
          return cb ? cb(err) : this.Promise.reject(err);
        }
        const response = promisify(this.Promise, cb);
        const result = response.result;
        if (this._isFull() || this._idle.length) {
          if (this._idle.length) {
            process.nextTick(() => this._pulseQueue());
          }
          if (!this.options.connectionTimeoutMillis) {
            this._pendingQueue.push(new PendingItem(response.callback));
            return result;
          }
          const queueCallback = (err, res, done) => {
            clearTimeout(tid);
            response.callback(err, res, done);
          };
          const pendingItem = new PendingItem(queueCallback);
          const tid = setTimeout(() => {
            removeWhere(this._pendingQueue, (i) => i.callback === queueCallback);
            pendingItem.timedOut = true;
            response.callback(new Error("timeout exceeded when trying to connect"));
          }, this.options.connectionTimeoutMillis);
          if (tid.unref) {
            tid.unref();
          }
          this._pendingQueue.push(pendingItem);
          return result;
        }
        this.newClient(new PendingItem(response.callback));
        return result;
      }
      newClient(pendingItem) {
        const client = new this.Client(this.options);
        this._clients.push(client);
        const idleListener = makeIdleListener(this, client);
        this.log("checking client timeout");
        let tid;
        let timeoutHit = false;
        if (this.options.connectionTimeoutMillis) {
          tid = setTimeout(() => {
            if (client.connection) {
              this.log("ending client due to timeout");
              timeoutHit = true;
              client.connection.stream.destroy();
            } else if (!client.isConnected()) {
              this.log("ending client due to timeout");
              timeoutHit = true;
              client.end();
            }
          }, this.options.connectionTimeoutMillis);
        }
        this.log("connecting new client");
        client.connect((err) => {
          if (tid) {
            clearTimeout(tid);
          }
          client.on("error", idleListener);
          if (err) {
            this.log("client failed to connect", err);
            this._clients = this._clients.filter((c) => c !== client);
            if (timeoutHit) {
              err = new Error("Connection terminated due to connection timeout", { cause: err });
            }
            this._pulseQueue();
            if (!pendingItem.timedOut) {
              pendingItem.callback(err, void 0, NOOP);
            }
          } else {
            this.log("new client connected");
            if (this.options.onConnect) {
              this._promiseTry(() => this.options.onConnect(client)).then(
                () => {
                  this._afterConnect(client, pendingItem, idleListener);
                },
                (hookErr) => {
                  this._clients = this._clients.filter((c) => c !== client);
                  client.end(() => {
                    this._pulseQueue();
                    if (!pendingItem.timedOut) {
                      pendingItem.callback(hookErr, void 0, NOOP);
                    }
                  });
                }
              );
              return;
            }
            return this._afterConnect(client, pendingItem, idleListener);
          }
        });
      }
      _afterConnect(client, pendingItem, idleListener) {
        if (this.options.maxLifetimeSeconds !== 0) {
          const maxLifetimeTimeout = setTimeout(() => {
            this.log("ending client due to expired lifetime");
            this._expired.add(client);
            const idleIndex = this._idle.findIndex((idleItem) => idleItem.client === client);
            if (idleIndex !== -1) {
              this._acquireClient(
                client,
                new PendingItem((err, client2, clientRelease) => clientRelease()),
                idleListener,
                false
              );
            }
          }, this.options.maxLifetimeSeconds * 1e3);
          maxLifetimeTimeout.unref();
          client.once("end", () => clearTimeout(maxLifetimeTimeout));
        }
        return this._acquireClient(client, pendingItem, idleListener, true);
      }
      // acquire a client for a pending work item
      _acquireClient(client, pendingItem, idleListener, isNew) {
        if (isNew) {
          this.emit("connect", client);
        }
        this.emit("acquire", client);
        client.release = this._releaseOnce(client, idleListener);
        client.removeListener("error", idleListener);
        if (!pendingItem.timedOut) {
          if (isNew && this.options.verify) {
            this.options.verify(client, (err) => {
              if (err) {
                client.release(err);
                return pendingItem.callback(err, void 0, NOOP);
              }
              pendingItem.callback(void 0, client, client.release);
            });
          } else {
            pendingItem.callback(void 0, client, client.release);
          }
        } else {
          if (isNew && this.options.verify) {
            this.options.verify(client, client.release);
          } else {
            client.release();
          }
        }
      }
      // returns a function that wraps _release and throws if called more than once
      _releaseOnce(client, idleListener) {
        let released = false;
        return (err) => {
          if (released) {
            throwOnDoubleRelease();
          }
          released = true;
          this._release(client, idleListener, err);
        };
      }
      // release a client back to the poll, include an error
      // to remove it from the pool
      _release(client, idleListener, err) {
        client.on("error", idleListener);
        client._poolUseCount = (client._poolUseCount || 0) + 1;
        this.emit("release", err, client);
        if (err || this.ending || !client._queryable || client._ending || client._poolUseCount >= this.options.maxUses) {
          if (client._poolUseCount >= this.options.maxUses) {
            this.log("remove expended client");
          }
          return this._remove(client, this._pulseQueue.bind(this));
        }
        const isExpired = this._expired.has(client);
        if (isExpired) {
          this.log("remove expired client");
          this._expired.delete(client);
          return this._remove(client, this._pulseQueue.bind(this));
        }
        let tid;
        if (this.options.idleTimeoutMillis && this._isAboveMin()) {
          tid = setTimeout(() => {
            if (this._isAboveMin()) {
              this.log("remove idle client");
              this._remove(client, this._pulseQueue.bind(this));
            }
          }, this.options.idleTimeoutMillis);
          if (this.options.allowExitOnIdle) {
            tid.unref();
          }
        }
        if (this.options.allowExitOnIdle) {
          client.unref();
        }
        this._idle.push(new IdleItem(client, idleListener, tid));
        this._pulseQueue();
      }
      query(text, values, cb) {
        if (typeof text === "function") {
          const response2 = promisify(this.Promise, text);
          setImmediate(function() {
            return response2.callback(new Error("Passing a function as the first parameter to pool.query is not supported"));
          });
          return response2.result;
        }
        if (typeof values === "function") {
          cb = values;
          values = void 0;
        }
        const response = promisify(this.Promise, cb);
        cb = response.callback;
        this.connect((err, client) => {
          if (err) {
            return cb(err);
          }
          let clientReleased = false;
          const onError = (err2) => {
            if (clientReleased) {
              return;
            }
            clientReleased = true;
            client.release(err2);
            cb(err2);
          };
          client.once("error", onError);
          this.log("dispatching query");
          try {
            client.query(text, values, (err2, res) => {
              this.log("query dispatched");
              client.removeListener("error", onError);
              if (clientReleased) {
                return;
              }
              clientReleased = true;
              client.release(err2);
              if (err2) {
                return cb(err2);
              }
              return cb(void 0, res);
            });
          } catch (err2) {
            client.release(err2);
            return cb(err2);
          }
        });
        return response.result;
      }
      end(cb) {
        this.log("ending");
        if (this.ending) {
          const err = new Error("Called end on pool more than once");
          return cb ? cb(err) : this.Promise.reject(err);
        }
        this.ending = true;
        const promised = promisify(this.Promise, cb);
        this._endCallback = promised.callback;
        this._pulseQueue();
        return promised.result;
      }
      get waitingCount() {
        return this._pendingQueue.length;
      }
      get idleCount() {
        return this._idle.length;
      }
      get expiredCount() {
        return this._clients.reduce((acc, client) => acc + (this._expired.has(client) ? 1 : 0), 0);
      }
      get totalCount() {
        return this._clients.length;
      }
    };
    module2.exports = Pool2;
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/native/query.js
var require_query2 = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/native/query.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events").EventEmitter;
    var util = require("util");
    var utils = require_utils();
    var NativeQuery = module2.exports = function(config, values, callback) {
      EventEmitter.call(this);
      config = utils.normalizeQueryConfig(config, values, callback);
      this.text = config.text;
      this.values = config.values;
      this.name = config.name;
      this.queryMode = config.queryMode;
      this.callback = config.callback;
      this.state = "new";
      this._arrayMode = config.rowMode === "array";
      this._emitRowEvents = false;
      this.on(
        "newListener",
        function(event) {
          if (event === "row") this._emitRowEvents = true;
        }.bind(this)
      );
    };
    util.inherits(NativeQuery, EventEmitter);
    var errorFieldMap = {
      sqlState: "code",
      statementPosition: "position",
      messagePrimary: "message",
      messageDetail: "detail",
      messageHint: "hint",
      context: "where",
      schemaName: "schema",
      tableName: "table",
      columnName: "column",
      dataTypeName: "dataType",
      constraintName: "constraint",
      sourceFile: "file",
      sourceLine: "line",
      sourceFunction: "routine"
    };
    NativeQuery.prototype.handleError = function(err) {
      const fields = this.native && this.native.pq.resultErrorFields();
      if (fields) {
        for (const key2 in fields) {
          const normalizedFieldName = errorFieldMap[key2] || key2;
          err[normalizedFieldName] = fields[key2];
        }
      }
      if (this.callback) {
        this.callback(err);
      } else {
        this.emit("error", err);
      }
      this.state = "error";
    };
    NativeQuery.prototype.then = function(onSuccess, onFailure) {
      return this._getPromise().then(onSuccess, onFailure);
    };
    NativeQuery.prototype.catch = function(callback) {
      return this._getPromise().catch(callback);
    };
    NativeQuery.prototype._getPromise = function() {
      if (this._promise) return this._promise;
      this._promise = new Promise(
        function(resolve4, reject) {
          this._once("end", resolve4);
          this._once("error", reject);
        }.bind(this)
      );
      return this._promise;
    };
    NativeQuery.prototype.submit = function(client) {
      this.state = "running";
      const self = this;
      this.native = client.native;
      client.native.arrayMode = this._arrayMode;
      let after = function(err, rows, results) {
        client.native.arrayMode = false;
        setImmediate(function() {
          self.emit("_done");
        });
        if (err) {
          return self.handleError(err);
        }
        if (self._emitRowEvents) {
          if (results.length > 1) {
            rows.forEach((rowOfRows, i) => {
              rowOfRows.forEach((row) => {
                self.emit("row", row, results[i]);
              });
            });
          } else {
            rows.forEach(function(row) {
              self.emit("row", row, results);
            });
          }
        }
        self.state = "end";
        self.emit("end", results);
        if (self.callback) {
          self.callback(null, results);
        }
      };
      if (process.domain) {
        after = process.domain.bind(after);
      }
      if (this.name) {
        if (this.name.length > 63) {
          console.error("Warning! Postgres only supports 63 characters for query names.");
          console.error("You supplied %s (%s)", this.name, this.name.length);
          console.error("This can cause conflicts and silent errors executing queries");
        }
        const values = (this.values || []).map(utils.prepareValue);
        if (client.namedQueries[this.name] !== void 0) {
          if (this.text && client.namedQueries[this.name] !== this.text) {
            const err = new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
            return after(err);
          }
          return client.native.execute(this.name, values, after);
        }
        return client.native.prepare(this.name, this.text, values.length, function(err) {
          if (err) return after(err);
          client.namedQueries[self.name] = self.text;
          return self.native.execute(self.name, values, after);
        });
      } else if (this.values) {
        if (!Array.isArray(this.values)) {
          const err = new Error("Query values must be an array");
          return after(err);
        }
        const vals = this.values.map(utils.prepareValue);
        client.native.query(this.text, vals, after);
      } else if (this.queryMode === "extended") {
        client.native.query(this.text, [], after);
      } else {
        client.native.query(this.text, after);
      }
    };
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/native/client.js
var require_client2 = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/native/client.js"(exports2, module2) {
    var nodeUtils = require("util");
    var Native;
    try {
      Native = require("pg-native");
    } catch (e) {
      throw e;
    }
    var TypeOverrides2 = require_type_overrides();
    var EventEmitter = require("events").EventEmitter;
    var util = require("util");
    var ConnectionParameters = require_connection_parameters();
    var NativeQuery = require_query2();
    var queryQueueLengthDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead."
    );
    var Client2 = module2.exports = function(config) {
      EventEmitter.call(this);
      config = config || {};
      this._Promise = config.Promise || global.Promise;
      this._types = new TypeOverrides2(config.types);
      this.native = new Native({
        types: this._types
      });
      this._queryQueue = [];
      this._ending = false;
      this._connecting = false;
      this._connected = false;
      this._queryable = true;
      this.pipeline = Boolean(config.pipeline);
      this._pipelineInFlight = false;
      const cp = this.connectionParameters = new ConnectionParameters(config);
      if (config.nativeConnectionString) cp.nativeConnectionString = config.nativeConnectionString;
      this.user = cp.user;
      Object.defineProperty(this, "password", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: cp.password
      });
      this.database = cp.database;
      this.host = cp.host;
      this.port = cp.port;
      this.namedQueries = {};
    };
    Client2.Query = NativeQuery;
    util.inherits(Client2, EventEmitter);
    Client2.prototype._errorAllQueries = function(err) {
      const enqueueError = (query) => {
        process.nextTick(() => {
          query.native = this.native;
          query.handleError(err);
        });
      };
      if (this._hasActiveQuery()) {
        enqueueError(this._activeQuery);
        this._activeQuery = null;
      }
      this._queryQueue.forEach(enqueueError);
      this._queryQueue.length = 0;
    };
    Client2.prototype._connect = function(cb) {
      const self = this;
      if (this._connecting) {
        process.nextTick(() => cb(new Error("Client has already been connected. You cannot reuse a client.")));
        return;
      }
      this._connecting = true;
      this.connectionParameters.getLibpqConnectionString(function(err, conString) {
        if (self.connectionParameters.nativeConnectionString) conString = self.connectionParameters.nativeConnectionString;
        if (err) return cb(err);
        self.native.connect(conString, function(err2) {
          if (err2) {
            self.native.end();
            return cb(err2);
          }
          self._connected = true;
          self.native.on("error", function(err3) {
            self._queryable = false;
            self._errorAllQueries(err3);
            self.emit("error", err3);
          });
          self.native.on("notification", function(msg) {
            self.emit("notification", {
              channel: msg.relname,
              payload: msg.extra
            });
          });
          self.emit("connect");
          self._pulseQueryQueue(true);
          cb(null, this);
        });
      });
    };
    Client2.prototype.connect = function(callback) {
      if (callback) {
        this._connect(callback);
        return;
      }
      return new this._Promise((resolve4, reject) => {
        this._connect((error) => {
          if (error) {
            reject(error);
          } else {
            resolve4(this);
          }
        });
      });
    };
    Client2.prototype.query = function(config, values, callback) {
      let query;
      let result;
      let readTimeout;
      let readTimeoutTimer;
      let queryCallback;
      if (config === null || config === void 0) {
        throw new TypeError("Client was passed a null or undefined query");
      } else if (typeof config.submit === "function") {
        readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        result = query = config;
        if (typeof values === "function") {
          config.callback = values;
        }
      } else {
        readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        query = new NativeQuery(config, values, callback);
        if (!query.callback) {
          let resolveOut, rejectOut;
          result = new this._Promise((resolve4, reject) => {
            resolveOut = resolve4;
            rejectOut = reject;
          }).catch((err) => {
            Error.captureStackTrace(err);
            throw err;
          });
          query.callback = (err, res) => err ? rejectOut(err) : resolveOut(res);
        }
      }
      if (readTimeout) {
        queryCallback = query.callback || (() => {
        });
        readTimeoutTimer = setTimeout(() => {
          const error = new Error("Query read timeout");
          process.nextTick(() => {
            query.handleError(error, this.connection);
          });
          queryCallback(error);
          query.callback = () => {
          };
          const index = this._queryQueue.indexOf(query);
          if (index > -1) {
            this._queryQueue.splice(index, 1);
          }
          this._pulseQueryQueue();
        }, readTimeout);
        query.callback = (err, res) => {
          clearTimeout(readTimeoutTimer);
          queryCallback(err, res);
        };
      }
      if (!this._queryable) {
        query.native = this.native;
        process.nextTick(() => {
          query.handleError(new Error("Client has encountered a connection error and is not queryable"));
        });
        return result;
      }
      if (this._ending) {
        query.native = this.native;
        process.nextTick(() => {
          query.handleError(new Error("Client was closed and is not queryable"));
        });
        return result;
      }
      if (this._queryQueue.length > 0 && !this.pipeline) {
        queryQueueLengthDeprecationNotice();
      }
      this._queryQueue.push(query);
      this._pulseQueryQueue();
      return result;
    };
    Client2.prototype.end = function(cb) {
      const self = this;
      this._ending = true;
      if (this._connecting && !this._connected) {
        this.once("connect", () => {
          this.end(() => {
          });
        });
      }
      let result;
      if (!cb) {
        result = new this._Promise(function(resolve4, reject) {
          cb = (err) => err ? reject(err) : resolve4();
        });
      }
      const doEnd = function() {
        self.native.end(function() {
          self._connected = false;
          self._errorAllQueries(new Error("Connection terminated"));
          process.nextTick(() => {
            self.emit("end");
            if (cb) cb();
          });
        });
      };
      if (this.pipeline && (this._pipelineInFlight || this._queryQueue.length > 0)) {
        this.once("drain", doEnd);
      } else {
        doEnd();
      }
      return result;
    };
    Client2.prototype._hasActiveQuery = function() {
      return this._activeQuery && this._activeQuery.state !== "error" && this._activeQuery.state !== "end";
    };
    Client2.prototype._pulseQueryQueue = function(initialConnection) {
      if (!this._connected) {
        return;
      }
      if (this.pipeline && !initialConnection) {
        return this._pulsePipelinedQueryQueue();
      }
      if (this._hasActiveQuery()) {
        return;
      }
      const query = this._queryQueue.shift();
      if (!query) {
        if (!initialConnection) {
          this.emit("drain");
        }
        return;
      }
      this._activeQuery = query;
      query.submit(this);
      const self = this;
      query.once("_done", function() {
        self._pulseQueryQueue();
      });
    };
    Client2.prototype._pulsePipelinedQueryQueue = function() {
      if (!this._connected || this._pipelineInFlight) {
        return;
      }
      if (this._queryQueue.length === 0) {
        if (this.hasExecuted) {
          this.emit("drain");
        }
        return;
      }
      this._pipelineInFlight = true;
      const self = this;
      const queries = [];
      const nativeQueries = [];
      const utils = require_utils();
      while (this._queryQueue.length > 0) {
        const query = this._queryQueue.shift();
        this.hasExecuted = true;
        nativeQueries.push(query);
        const values = query.values ? query.values.map(utils.prepareValue) : null;
        const pipelineEntry = { text: query.text, name: query.name, arrayMode: query._arrayMode };
        if (values) {
          pipelineEntry.values = values;
        }
        if (query.name && this.namedQueries[query.name]) {
          pipelineEntry._alreadyPrepared = true;
        }
        queries.push(pipelineEntry);
      }
      this.native.pipeline(queries, function(err, results) {
        self._pipelineInFlight = false;
        if (err) {
          self._connected = false;
          self._queryable = false;
          for (let i = 0; i < nativeQueries.length; i++) {
            const q = nativeQueries[i];
            q.native = self.native;
            q.handleError(err);
          }
          self._errorAllQueries(err);
          self.emit("error", err);
          self.emit("end");
          return;
        }
        for (let i = 0; i < nativeQueries.length; i++) {
          const q = nativeQueries[i];
          const r = results[i];
          q.native = self.native;
          if (r.err) {
            q.handleError(r.err);
          } else {
            if (q.name) {
              self.namedQueries[q.name] = q.text;
            }
            q.state = "end";
            q.emit("end", r.result);
            if (q.callback) {
              q.callback(null, r.result);
            }
          }
          setImmediate(function() {
            q.emit("_done");
          });
        }
        self._pulsePipelinedQueryQueue();
      });
    };
    Client2.prototype.cancel = function(query) {
      if (this._activeQuery === query) {
        this.native.cancel(function() {
        });
      } else if (this._queryQueue.indexOf(query) !== -1) {
        this._queryQueue.splice(this._queryQueue.indexOf(query), 1);
      }
    };
    Client2.prototype.ref = function() {
    };
    Client2.prototype.unref = function() {
    };
    Client2.prototype.setTypeParser = function(oid, format, parseFn) {
      return this._types.setTypeParser(oid, format, parseFn);
    };
    Client2.prototype.getTypeParser = function(oid, format) {
      return this._types.getTypeParser(oid, format);
    };
    Client2.prototype.isConnected = function() {
      return this._connected;
    };
    Client2.prototype.getTransactionStatus = function() {
      return this.native.getTransactionStatus();
    };
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/native/index.js
var require_native = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/native/index.js"(exports2, module2) {
    "use strict";
    module2.exports = require_client2();
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js
var require_lib2 = __commonJS({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js"(exports2, module2) {
    "use strict";
    var Client2 = require_client();
    var defaults2 = require_defaults();
    var Connection2 = require_connection();
    var Result2 = require_result();
    var utils = require_utils();
    var Pool2 = require_pg_pool();
    var TypeOverrides2 = require_type_overrides();
    var { DatabaseError: DatabaseError2 } = require_dist();
    var { escapeIdentifier: escapeIdentifier2, escapeLiteral: escapeLiteral2 } = require_utils();
    var poolFactory = (Client3) => {
      return class BoundPool extends Pool2 {
        constructor(options) {
          super(options, Client3);
        }
      };
    };
    var PG = function(clientConstructor2) {
      this.defaults = defaults2;
      this.Client = clientConstructor2;
      this.Query = this.Client.Query;
      this.Pool = poolFactory(this.Client);
      this._pools = [];
      this.Connection = Connection2;
      this.types = require_pg_types();
      this.DatabaseError = DatabaseError2;
      this.TypeOverrides = TypeOverrides2;
      this.escapeIdentifier = escapeIdentifier2;
      this.escapeLiteral = escapeLiteral2;
      this.Result = Result2;
      this.utils = utils;
    };
    var clientConstructor = Client2;
    var forceNative = false;
    try {
      forceNative = !!process.env.NODE_PG_FORCE_NATIVE;
    } catch {
    }
    if (forceNative) {
      clientConstructor = require_native();
    }
    module2.exports = new PG(clientConstructor);
    Object.defineProperty(module2.exports, "native", {
      configurable: true,
      enumerable: false,
      get() {
        let native = null;
        try {
          native = new PG(require_native());
        } catch (err) {
          if (err.code !== "MODULE_NOT_FOUND") {
            throw err;
          }
        }
        Object.defineProperty(module2.exports, "native", {
          value: native
        });
        return native;
      }
    });
  }
});

// node_modules/.pnpm/pg@8.23.1/node_modules/pg/esm/index.mjs
var esm_exports = {};
__export(esm_exports, {
  Client: () => Client,
  Connection: () => Connection,
  DatabaseError: () => DatabaseError,
  Pool: () => Pool,
  Query: () => Query,
  Result: () => Result,
  TypeOverrides: () => TypeOverrides,
  default: () => esm_default,
  defaults: () => defaults,
  escapeIdentifier: () => escapeIdentifier,
  escapeLiteral: () => escapeLiteral,
  types: () => types
});
var import_lib, Client, Pool, Connection, types, Query, DatabaseError, escapeIdentifier, escapeLiteral, Result, TypeOverrides, defaults, esm_default;
var init_esm = __esm({
  "node_modules/.pnpm/pg@8.23.1/node_modules/pg/esm/index.mjs"() {
    import_lib = __toESM(require_lib2(), 1);
    Client = import_lib.default.Client;
    Pool = import_lib.default.Pool;
    Connection = import_lib.default.Connection;
    types = import_lib.default.types;
    Query = import_lib.default.Query;
    DatabaseError = import_lib.default.DatabaseError;
    escapeIdentifier = import_lib.default.escapeIdentifier;
    escapeLiteral = import_lib.default.escapeLiteral;
    Result = import_lib.default.Result;
    TypeOverrides = import_lib.default.TypeOverrides;
    defaults = import_lib.default.defaults;
    esm_default = import_lib.default;
  }
});

// src/safety/redact.ts
var REDACTED = "[REDACTED]";
function secretVariants(secret) {
  const out = /* @__PURE__ */ new Set();
  if (!secret) return [];
  out.add(secret);
  try {
    out.add(encodeURIComponent(secret));
  } catch {
  }
  out.add(encodeURIComponent(secret).replace(/%20/g, "+"));
  try {
    out.add(decodeURIComponent(secret));
  } catch {
  }
  out.add(encodeURI(secret));
  out.add(encodeURIComponent(secret).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase()));
  return [...out].filter((v) => v.length >= 1).sort((a, b) => b.length - a.length);
}
function redact(text, secrets = []) {
  let out = text;
  for (const s of secrets) {
    for (const v of secretVariants(s)) {
      if (v.length < 2) continue;
      out = out.split(v).join(REDACTED);
    }
  }
  out = out.replace(/\b([a-z][a-z0-9+.-]*):\/\/[^\s/@'"]*@/gi, `$1://${REDACTED}@`);
  out = out.replace(/\b(password|passwd|pwd|sslpassword|sslkey|token|secret)(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s&;,'"]+)/gi, `$1$2${REDACTED}`);
  return out;
}
function describeError(err, secrets = [], depth = 0) {
  if (depth > 5 || err === null || err === void 0) return [];
  const out = [];
  if (err instanceof Error || typeof err === "object" && err !== null && "message" in err) {
    const e = err;
    const code = typeof e.code === "string" ? e.code.slice(0, 64) : void 0;
    const msg = typeof e.message === "string" ? e.message : String(e.message);
    out.push({ ...code ? { code } : {}, message: redact(msg, secrets).slice(0, 2e3) });
    if (Array.isArray(e.errors)) for (const sub of e.errors.slice(0, 10)) out.push(...describeError(sub, secrets, depth + 1));
    if (e.cause !== void 0) out.push(...describeError(e.cause, secrets, depth + 1));
  } else {
    out.push({ message: redact(String(err), secrets).slice(0, 2e3) });
  }
  return out;
}
function formatError(err, secrets = []) {
  return describeError(err, secrets).map((e) => e.code ? `[${e.code}] ${e.message}` : e.message).join(" <- caused by: ");
}

// src/safety/sanitize.ts
function stripControl(s) {
  const noAnsi = s.replace(/\u001b\][^\u0007\u001b]*(\u0007|\u001b\\)?/g, "").replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "").replace(/\u001b[@-Z\\-_]/g, "");
  let out = "";
  for (const ch of noAnsi) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 10 || cp === 9) {
      out += ch;
    } else if (cp < 32 || cp >= 127 && cp < 160 || cp === 8232 || cp === 8233 || cp >= 8234 && cp <= 8238 || cp >= 8294 && cp <= 8297) {
      out += `\\u{${cp.toString(16)}}`;
    } else {
      out += ch;
    }
  }
  return out;
}
function safeText(s) {
  return stripControl(s).replace(/\n/g, "\\n");
}
function mdText(s) {
  return safeText(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/([\\`*_{}[\]()#+\-.!|~])/g, "\\$1");
}
function mdCode(s) {
  const t = safeText(s);
  let longest = 0;
  for (const m of t.matchAll(/`+/g)) longest = Math.max(longest, m[0].length);
  const fence = "`".repeat(longest + 1);
  const pad = t.startsWith("`") || t.endsWith("`") || t === "" ? " " : "";
  return `${fence}${pad}${t}${pad}${fence}`;
}

// src/cli/main.ts
var import_node_path3 = require("node:path");
var import_node_util = require("node:util");

// src/core/errors.ts
var DbpError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "DbpError";
    this.code = code;
  }
};

// src/core/engine.ts
var import_node_crypto2 = require("node:crypto");

// src/prisma/discover.ts
var import_node_crypto = require("node:crypto");
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var DISCOVERY_LIMITS = {
  maxFiles: 500,
  maxFileBytes: 5 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxDepth: 32
};
var EXCLUDED_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", "out", "coverage", ".next", ".turbo", "generated"]);
function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
var utf8 = new TextDecoder("utf-8", { fatal: true });
function discoverPrismaFiles(input, limits = DISCOVERY_LIMITS) {
  const abs = (0, import_node_path.resolve)(input);
  let st;
  try {
    st = (0, import_node_fs.lstatSync)(abs);
  } catch {
    throw new DbpError("SCHEMA_NOT_FOUND", "--schema path does not exist or is not readable");
  }
  if (st.isSymbolicLink()) {
    throw new DbpError("SCHEMA_SYMLINK", "--schema must not be a symbolic link (symlinks are not followed)");
  }
  const skipped = [];
  const found = [];
  let root;
  let inputKind;
  if (st.isFile()) {
    if (!abs.toLowerCase().endsWith(".prisma")) {
      throw new DbpError("SCHEMA_NOT_PRISMA", "--schema file must have the .prisma extension");
    }
    inputKind = "file";
    root = (0, import_node_path.dirname)(abs);
    found.push({ relPath: (0, import_node_path.basename)(abs), absPath: abs });
  } else if (st.isDirectory()) {
    inputKind = "directory";
    root = abs;
    const walk = (dir, rel, depth) => {
      if (depth > limits.maxDepth) {
        skipped.push({ path: rel || ".", reason: "maximum directory depth exceeded" });
        return;
      }
      const entries = (0, import_node_fs.readdirSync)(dir, { withFileTypes: true }).map((e) => e.name).sort(compareStrings);
      for (const name of entries) {
        const childAbs = (0, import_node_path.join)(dir, name);
        const childRel = rel ? `${rel}/${name}` : name;
        const cst = (0, import_node_fs.lstatSync)(childAbs);
        if (cst.isSymbolicLink()) {
          skipped.push({ path: childRel, reason: "symbolic link not followed" });
          continue;
        }
        if (cst.isDirectory()) {
          if (EXCLUDED_DIRS.has(name)) {
            skipped.push({ path: childRel, reason: "excluded directory" });
            continue;
          }
          walk(childAbs, childRel, depth + 1);
        } else if (cst.isFile() && name.toLowerCase().endsWith(".prisma")) {
          found.push({ relPath: childRel, absPath: childAbs });
          if (found.length > limits.maxFiles) {
            throw new DbpError("SCHEMA_TOO_MANY_FILES", `more than ${limits.maxFiles} .prisma files under --schema`);
          }
        }
      }
    };
    walk(abs, "", 0);
  } else {
    throw new DbpError("SCHEMA_NOT_FILE", "--schema must be a regular file or a directory");
  }
  if (found.length === 0) {
    throw new DbpError("SCHEMA_EMPTY", "no .prisma files found under --schema");
  }
  let total = 0;
  const files = [];
  for (const f of found) {
    const size = (0, import_node_fs.lstatSync)(f.absPath).size;
    if (size > limits.maxFileBytes) {
      throw new DbpError("SCHEMA_FILE_TOO_LARGE", `${f.relPath} exceeds the ${limits.maxFileBytes} byte limit`);
    }
    total += size;
    if (total > limits.maxTotalBytes) {
      throw new DbpError("SCHEMA_TOO_LARGE", `.prisma files exceed the ${limits.maxTotalBytes} byte total limit`);
    }
    const buf = (0, import_node_fs.readFileSync)(f.absPath);
    let text;
    try {
      text = utf8.decode(buf);
    } catch {
      throw new DbpError("SCHEMA_NOT_UTF8", `${f.relPath} is not valid UTF-8`);
    }
    files.push({
      relPath: f.relPath,
      absPath: f.absPath,
      text,
      sha256: (0, import_node_crypto.createHash)("sha256").update(buf).digest("hex"),
      bytes: buf.length
    });
  }
  return { inputKind, root, files, skipped };
}

// src/core/rules.ts
var RULES = {
  DBP001: {
    id: "DBP001",
    title: "Prisma 1:1 relation without a matching uniqueness declaration",
    summary: "A relation resolved as 1:1 from both relation fields has no @unique/@id (single field) or @@unique/@@id with exactly the relation fields in the same order on the defining side (Prisma ORM 7 P1012)."
  },
  DBP002: {
    id: "DBP002",
    title: "Declared uniqueness not guaranteed by the database",
    summary: "A Prisma @id/@@id/@unique/@@unique column set is not covered by a supported PK, UNIQUE constraint or valid unique index on the same columns or a subset."
  },
  DBP003: {
    id: "DBP003",
    title: "Mapped table or column missing",
    summary: "After applying @@schema, @@map and @map, the physical table or column does not exist in the inspected schema."
  },
  DBP004: {
    id: "DBP004",
    title: "Foreign key correspondence mismatch",
    summary: 'With relationMode = "foreignKeys", the expected FK is missing or pairs source and target columns differently. Not applicable with relationMode = "prisma".'
  },
  DBP005: {
    id: "DBP005",
    title: "1:1 intent not guaranteed by database structure",
    summary: "For a resolved 1:1 relation, the referencing columns are not unique in the database, so the structure allows duplicates."
  },
  DBP006: {
    id: "DBP006",
    title: "Scalar nullability mismatch",
    summary: "A scalar field's optionality differs from its column's nullability. Relation field optionality is never used."
  }
};
var RULE_IDS = Object.keys(RULES).sort();

// src/core/uniqueness.ts
function unsupportedKeyReason(k) {
  if (k.kind === "exclusion_constraint") return "exclusion constraint semantics are not evaluated";
  if (k.columns === null || k.expression) return "expression index";
  if (k.partial) return "partial index (WHERE clause)";
  if (!k.valid) return "index is not valid";
  if (k.deferrable || !k.immediate) return "deferrable uniqueness";
  if (k.period) return "WITHOUT OVERLAPS / PERIOD key";
  return void 0;
}
function isSubset(subset, superset) {
  const s = new Set(superset);
  return subset.every((c) => s.has(c));
}
function evaluateUniqueness(table, columns, schemaComplete) {
  if (table.inheritance.hasInheritanceChildren) {
    return {
      status: "unknown",
      reasonCode: "ordinary_inheritance",
      reason: "table has ordinary (INHERITS) child tables whose rows are not covered by its unique indexes",
      uncertainKeys: []
    };
  }
  const supported = table.uniqueKeys.filter((k) => unsupportedKeyReason(k) === void 0 && k.columns !== null && k.columns.length > 0).filter((k) => isSubset(k.columns, columns)).sort((a, b) => (a.columns?.length ?? 0) - (b.columns?.length ?? 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (supported.length > 0) {
    return { status: "guaranteed", key: supported[0], uncertainKeys: [] };
  }
  const uncertain = table.uniqueKeys.filter((k) => unsupportedKeyReason(k) !== void 0 && (k.columns === null || isSubset(k.columns, columns)));
  if (uncertain.length > 0) {
    return {
      status: "unknown",
      reasonCode: "unsupported_unique_semantics",
      reason: `possible uniqueness via ${uncertain.map((k) => `${k.name} (${unsupportedKeyReason(k)})`).join(", ")} is not evaluated`,
      uncertainKeys: uncertain
    };
  }
  if (!schemaComplete) {
    return {
      status: "unknown",
      reasonCode: "incomplete_collection",
      reason: "metadata collection for this schema was incomplete",
      uncertainKeys: []
    };
  }
  return { status: "not_guaranteed", uncertainKeys: [] };
}

// src/core/engine.ts
var NOT_COVERED = [
  "Row data: table rows are never read, so existing duplicates or orphaned rows are not detected.",
  "CHECK constraints, triggers, defaults, generated columns, RLS policies and privileges.",
  "Migration safety, lock impact and production readiness.",
  "Prisma Client runtime behaviour and generated client code.",
  "Database objects outside the requested schemas."
];
function stableId(ruleId, subject) {
  return `${ruleId}-${(0, import_node_crypto2.createHash)("sha256").update(subject).digest("hex").slice(0, 10)}`;
}
function prismaEvidence(span, detail) {
  return { kind: "prisma", file: span.file, line: span.line, column: span.column, detail };
}
function plist(list) {
  return `[${list.join(", ")}]`;
}
function cols(list) {
  return `(${list.join(", ")})`;
}
function runEngine(input) {
  const { prisma, db, defaultSchema } = input;
  const checks = [];
  const findings = [];
  const modelsByName = new Map(prisma.models.map((m) => [m.name, m]));
  const tableIndex = new Map(db.tables.map((t) => [JSON.stringify([t.schema, t.name]), t]));
  const otherIndex = new Map(db.otherRelations.map((r) => [JSON.stringify([r.schema, r.name]), r]));
  const dbComplete = db.complete && db.gaps.length === 0;
  const schemaComplete = (schema) => {
    if (dbComplete) return true;
    if (db.gaps.length === 0) return false;
    return !db.gaps.some((g) => g.scope === schema || g.scope === "*");
  };
  const resolveTable = (m) => {
    const schema = m.schema ?? defaultSchema;
    if (!schema) {
      return {
        status: "unknown",
        reasonCode: "default_schema_unknown",
        reason: `model ${m.name} has no @@schema and no --default-schema was given; the database schema is not guessed`
      };
    }
    if (!db.requestedSchemas.includes(schema)) {
      return { status: "unknown", reasonCode: "schema_out_of_scope", reason: `schema "${schema}" was not part of the inspected scope` };
    }
    const key2 = JSON.stringify([schema, m.dbName]);
    const table = tableIndex.get(key2);
    if (table) return { status: "found", schema, table };
    const other = otherIndex.get(key2);
    if (other) {
      return {
        status: "unknown",
        reasonCode: "unsupported_relation_kind",
        reason: `${schema}.${m.dbName} exists as a ${other.kind.replace("_", " ")}, which v0.1 does not evaluate`
      };
    }
    if (!schemaComplete(schema)) {
      return { status: "unknown", reasonCode: "incomplete_collection", reason: `metadata collection for schema "${schema}" was incomplete` };
    }
    return { status: "missing", schema, name: m.dbName };
  };
  const modelGate = (m) => {
    if (m.ignored) return { status: "not_applicable", reasonCode: "model_ignored", reason: `model ${m.name} has @@ignore` };
    if (m.blockKind === "view") return { status: "unknown", reasonCode: "view_not_supported", reason: `view ${m.name} is not evaluated by v0.1` };
    if (m.issues.length > 0) {
      return {
        status: "unknown",
        reasonCode: "prisma_model_not_fully_parsed",
        reason: `model ${m.name}: ${m.issues[0].message}${m.issues.length > 1 ? ` (+${m.issues.length - 1} more)` : ""}`
      };
    }
    return void 0;
  };
  const addCheck = (ruleId, subject, status, evidence2, reasonCode, reason) => {
    const c = { id: `${ruleId}:${subject}`, ruleId, subject, status, evidence: evidence2, ...reasonCode ? { reasonCode } : {}, ...reason ? { reason } : {} };
    checks.push(c);
    return c;
  };
  const addFinding = (check, severity, title, groupId, explanation, reviewOptions) => {
    const f = {
      id: stableId(check.ruleId, check.subject),
      ruleId: check.ruleId,
      severity,
      title,
      subject: check.subject,
      groupId,
      relatedFindingIds: [],
      explanation,
      evidence: check.evidence,
      reviewOptions
    };
    check.findingId = f.id;
    findings.push(f);
    return f;
  };
  const fieldColumns = (m, names) => {
    const out = [];
    for (const n of names) {
      const f = m.fields.find((x) => x.name === n);
      if (!f) return { ok: false, reason: `field "${n}" does not exist on model ${m.name}` };
      if (f.kind === "relation" || f.kind === "unknown_type") return { ok: false, reason: `field "${n}" on model ${m.name} is not a scalar field` };
      if (f.issues.length > 0) return { ok: false, reason: `field "${n}" on model ${m.name}: ${f.issues[0].message}` };
      out.push(f);
    }
    return { ok: true, fields: out };
  };
  const tableEvidence = (t, detail, extra) => ({
    kind: "database",
    object: `${t.schema}.${t.name}`,
    detail,
    ...extra?.constraint ? { constraint: extra.constraint } : {},
    ...extra?.columns ? { columns: extra.columns } : {}
  });
  const resolutions = /* @__PURE__ */ new Map();
  for (const m of prisma.models) resolutions.set(m.name, resolveTable(m));
  const missingColumns = /* @__PURE__ */ new Map();
  for (const m of prisma.models) {
    const subject = `model ${m.name}`;
    const gate = modelGate(m);
    if (gate) {
      addCheck("DBP003", subject, gate.status, [prismaEvidence(m.span, `${m.blockKind} ${m.name}`)], gate.reasonCode, gate.reason);
      continue;
    }
    const r = resolutions.get(m.name);
    const ev = [prismaEvidence(m.span, `model ${m.name} maps to table "${m.dbName}"${m.schema ? ` in @@schema("${m.schema}")` : ""}`)];
    if (r.status === "unknown") {
      addCheck("DBP003", subject, "unknown", ev, r.reasonCode, r.reason);
      continue;
    }
    if (r.status === "missing") {
      ev.push({ kind: "database", object: `${r.schema}.${r.name}`, detail: "no table, view or foreign table with this name in the inspected schema" });
      const c = addCheck("DBP003", subject, "fail", ev, "table_missing", `table ${r.schema}.${r.name} was not found`);
      addFinding(
        c,
        "error",
        `Mapped table ${r.schema}.${r.name} for model ${m.name} was not found`,
        `model:${m.name}`,
        {
          observed: [
            `Model ${m.name} resolves to ${r.schema}.${r.name} after applying @@schema/@@map (or --default-schema).`,
            `The inspected schema "${r.schema}" contains no relation with that name.`
          ],
          expected: "A table with the mapped name exists in the mapped schema.",
          difference: `Table ${r.schema}.${r.name} is missing from the collected metadata.`,
          impact: "Prisma queries for this model would fail against this database, and other checks for this model cannot be evaluated.",
          notChecked: ["Whether the table exists under a different name or schema; db-preflight does not search by Prisma logical names."]
        },
        [
          "Confirm which database and schema this Prisma schema targets (the scanned database or snapshot may be a different environment).",
          "If the table was renamed, review whether @@map/@@schema in the Prisma schema need to change.",
          "If the table was never created, review the migration history before applying anything."
        ]
      );
      missingColumns.set(m.name, new Set(m.fields.map((f) => f.name)));
      continue;
    }
    const t = r.table;
    const colSet = new Set(t.columns.map((c) => c.name));
    const missing = [];
    const unevaluable = [];
    for (const f of m.fields) {
      if (f.kind === "relation" || f.ignored) continue;
      if (f.issues.length > 0) {
        unevaluable.push(f);
        continue;
      }
      if (!colSet.has(f.dbName)) missing.push(f);
    }
    ev.push(tableEvidence(t, `table found with ${t.columns.length} columns`));
    missingColumns.set(m.name, new Set(missing.map((f) => f.name)));
    if (missing.length > 0 && !schemaComplete(t.schema)) {
      addCheck("DBP003", subject, "unknown", ev, "incomplete_collection", `metadata collection for schema "${t.schema}" was incomplete`);
    } else if (missing.length > 0) {
      for (const f of missing) ev.push(prismaEvidence(f.span, `field ${f.name} maps to column "${f.dbName}", which is absent`));
      const c = addCheck("DBP003", subject, "fail", ev, "column_missing", `${missing.length} mapped column(s) missing`);
      addFinding(
        c,
        "error",
        `Model ${m.name}: ${missing.length} mapped column(s) missing in ${t.schema}.${t.name}`,
        `model:${m.name}`,
        {
          observed: missing.map((f) => `Field ${f.name} maps to column "${f.dbName}" (after @map), which ${t.schema}.${t.name} does not have.`),
          expected: "Every non-relation field maps to an existing column of the mapped table.",
          difference: `Missing column(s): ${missing.map((f) => f.dbName).join(", ")}.`,
          impact: "Prisma queries selecting these fields would fail against this database.",
          notChecked: ["Column types and defaults are not compared in v0.1."]
        },
        [
          "Check whether the column was renamed in the database and @map needs to reflect it.",
          "Check whether the field was added to Prisma without a corresponding reviewed migration."
        ]
      );
    } else if (unevaluable.length > 0) {
      addCheck("DBP003", subject, "unknown", ev, "prisma_field_not_evaluable", `fields not evaluable: ${unevaluable.map((f) => f.name).join(", ")}`);
    } else {
      addCheck("DBP003", subject, "pass", ev);
    }
  }
  for (const m of prisma.models) {
    const gate = modelGate(m);
    const r = resolutions.get(m.name);
    for (const f of m.fields) {
      if (f.kind === "relation") continue;
      const subject = `field ${m.name}.${f.name}`;
      const ev = [prismaEvidence(f.span, `${f.name} ${f.typeName}${f.isList ? "[]" : ""}${f.isOptional ? "?" : ""} -> column "${f.dbName}"`)];
      if (gate) {
        addCheck("DBP006", subject, gate.status, ev, gate.reasonCode, gate.reason);
        continue;
      }
      if (f.ignored) {
        addCheck("DBP006", subject, "not_applicable", ev, "field_ignored", "field has @ignore");
        continue;
      }
      if (f.isList) {
        addCheck("DBP006", subject, "not_applicable", ev, "scalar_list", "scalar lists are not compared for nullability in v0.1");
        continue;
      }
      if (f.issues.length > 0) {
        addCheck("DBP006", subject, "unknown", ev, "prisma_field_not_evaluable", f.issues[0].message);
        continue;
      }
      if (r.status === "unknown") {
        addCheck("DBP006", subject, "unknown", ev, r.reasonCode, r.reason);
        continue;
      }
      if (r.status === "missing" || missingColumns.get(m.name)?.has(f.name)) {
        addCheck("DBP006", subject, "unknown", ev, "blocked_by_DBP003", "the mapped table or column is missing (see DBP003)");
        continue;
      }
      const t = r.table;
      if (t.inheritance.hasInheritanceChildren) {
        addCheck("DBP006", subject, "unknown", ev, "ordinary_inheritance", "rows of ordinary (INHERITS) child tables may have different nullability");
        continue;
      }
      const col = t.columns.find((c2) => c2.name === f.dbName);
      if (!col) {
        addCheck("DBP006", subject, "unknown", ev, "blocked_by_DBP003", "column not found");
        continue;
      }
      ev.push(tableEvidence(t, `column "${col.name}" is ${col.nullable ? "NULLABLE" : "NOT NULL"}`, { columns: [col.name] }));
      if (col.domainType && col.nullable) {
        addCheck(
          "DBP006",
          subject,
          "unknown",
          ev,
          "domain_nullability_not_evaluated",
          "the column uses a domain type whose own NOT NULL is not evaluated by v0.1"
        );
        continue;
      }
      if (col.notNullUnvalidated) {
        addCheck("DBP006", subject, "unknown", ev, "not_null_not_validated", "the NOT NULL constraint is NOT VALID, so existing rows may contain NULL");
        continue;
      }
      const prismaNullable = f.isOptional;
      if (prismaNullable === col.nullable) {
        addCheck("DBP006", subject, "pass", ev);
        continue;
      }
      const required = !prismaNullable;
      const c = addCheck("DBP006", subject, "fail", ev, required ? "required_but_nullable" : "optional_but_not_null");
      addFinding(
        c,
        required ? "error" : "warning",
        required ? `${m.name}.${f.name} is required in Prisma but ${t.schema}.${t.name}.${col.name} is nullable` : `${m.name}.${f.name} is optional in Prisma but ${t.schema}.${t.name}.${col.name} is NOT NULL`,
        `model:${m.name}`,
        {
          observed: [
            `Prisma declares ${f.name} as ${required ? "required (no ?)" : "optional (?)"}.`,
            `Column ${t.schema}.${t.name}.${col.name} is ${col.nullable ? "nullable" : "NOT NULL"}.`
          ],
          expected: "Scalar field optionality matches column nullability.",
          difference: required ? "The database allows NULL where Prisma assumes a value is always present." : "Prisma allows writing NULL where the database rejects it.",
          impact: required ? "Reading a row whose column is NULL can fail or produce unexpected types in Prisma Client." : "Prisma Client accepts null for this field, but the database would reject such writes.",
          notChecked: ["Whether NULL values currently exist (rows are not read)."]
        },
        required ? [
          "If NULL is a valid business value, consider making the Prisma field optional.",
          "If the column must always have a value, check existing rows for NULLs before any NOT NULL migration is reviewed."
        ] : [
          "If NULL is never valid, consider making the Prisma field required.",
          "If NULL should be allowed, review whether the NOT NULL constraint is intentional."
        ]
      );
    }
  }
  const dbp002BySubject = /* @__PURE__ */ new Map();
  for (const m of prisma.models) {
    const gate = modelGate(m);
    const r = resolutions.get(m.name);
    for (const u of m.uniques) {
      const subject = `${u.kind === "id" ? "id" : "unique"} ${m.name}(${u.fields.join(", ")})`;
      const ev = [prismaEvidence(u.span, `${u.origin === "field" ? `@${u.kind}` : `@@${u.kind}`} on ${plist(u.fields)}`)];
      const done = (c) => dbp002BySubject.set(`${m.name}|${u.fields.join(",")}`, c);
      if (gate) {
        done(addCheck("DBP002", subject, gate.status, ev, gate.reasonCode, gate.reason));
        continue;
      }
      if (!u.supported) {
        done(addCheck("DBP002", subject, "unknown", ev, "prisma_unique_not_evaluable", u.unsupportedReason ?? "unsupported declaration"));
        continue;
      }
      const fc = fieldColumns(m, u.fields);
      if (!fc.ok) {
        done(addCheck("DBP002", subject, "unknown", ev, "prisma_field_not_evaluable", fc.reason));
        continue;
      }
      if (r.status === "unknown") {
        done(addCheck("DBP002", subject, "unknown", ev, r.reasonCode, r.reason));
        continue;
      }
      if (r.status === "missing" || fc.fields.some((f) => missingColumns.get(m.name)?.has(f.name))) {
        done(addCheck("DBP002", subject, "unknown", ev, "blocked_by_DBP003", "the mapped table or column is missing (see DBP003)"));
        continue;
      }
      const columns = fc.fields.map((f) => f.dbName);
      const res = evaluateUniqueness(r.table, columns, schemaComplete(r.schema));
      done(uniquenessCheck("DBP002", subject, ev, r.table, columns, res, m, u));
    }
  }
  function uniquenessCheck(ruleId, subject, ev, t, columns, res, m, u) {
    if (res.status === "guaranteed" && res.key) {
      ev.push(
        tableEvidence(t, `${res.key.kind.replace("_", " ")} ${res.key.name} on ${cols(res.key.columns ?? [])} guarantees uniqueness of ${cols(columns)}`, {
          constraint: res.key.name,
          columns: res.key.columns ?? []
        })
      );
      const nullable = columns.filter((c2) => t.columns.find((x) => x.name === c2)?.nullable);
      if (nullable.length > 0) {
        ev.push({ kind: "note", detail: `nullable column(s) ${nullable.join(", ")}: uniqueness applies to rows where these are non-null` });
      }
      return addCheck(ruleId, subject, "pass", ev);
    }
    for (const k of res.uncertainKeys) {
      ev.push(tableEvidence(t, `${k.kind.replace("_", " ")} ${k.name} not evaluated`, { constraint: k.name, ...k.columns ? { columns: k.columns } : {} }));
    }
    if (res.status === "unknown") return addCheck(ruleId, subject, "unknown", ev, res.reasonCode, res.reason);
    const others = t.uniqueKeys.filter((k) => k.columns && k.columns.length > 0).map((k) => `${k.name} ${cols(k.columns ?? [])}`);
    ev.push(
      tableEvidence(
        t,
        `no primary key, unique constraint or valid unique index on a subset of ${cols(columns)}${others.length ? `; existing keys: ${others.join("; ")}` : ""}`,
        {
          columns
        }
      )
    );
    const c = addCheck(ruleId, subject, "fail", ev, "uniqueness_not_guaranteed");
    if (ruleId === "DBP002") {
      addFinding(
        c,
        "error",
        `Prisma ${u?.kind === "id" ? "id" : "unique"} on ${m.name}(${u?.fields.join(", ")}) is not guaranteed by ${t.schema}.${t.name}`,
        `model:${m.name}`,
        {
          observed: [
            `Prisma declares ${u?.origin === "field" ? `@${u?.kind}` : `@@${u?.kind}`} on ${cols(u?.fields ?? [])} -> columns ${cols(columns)}.`,
            `${t.schema}.${t.name} has no primary key, unique constraint or valid unique index whose key columns are a subset of ${cols(columns)}.`
          ],
          expected: "Each Prisma uniqueness declaration is backed by a database key on the same columns or a subset of them.",
          difference: `The database structure allows duplicate values of ${cols(columns)}.`,
          impact: "Prisma Client treats this combination as unique (findUnique, upsert, 1:1 relations) while the database does not enforce it.",
          notChecked: ["Whether duplicate values currently exist (rows are not read)."]
        },
        [
          "If the combination is meant to be unique, check existing rows for duplicates before reviewing a migration that adds a constraint.",
          "If duplicates are legitimate, review whether the Prisma declaration should be removed or changed."
        ]
      );
    }
    return c;
  }
  const relMode = prisma.datasource?.relationMode;
  for (const rel of prisma.relations) {
    const subject = `relation ${rel.id}`;
    const ownerModel = rel.owner ? modelsByName.get(rel.owner.model) : void 0;
    const targetModel = rel.referencedModel ? modelsByName.get(rel.referencedModel) : void 0;
    const relEv = rel.owner ? [
      prismaEvidence(
        rel.owner.span,
        `${rel.owner.model}.${rel.owner.field} @relation(fields: ${plist(rel.owner.fields)}, references: ${plist(rel.owner.references)})`
      )
    ] : rel.ends.map((e) => prismaEvidence(e.span, `${e.model}.${e.field}`));
    if (rel.other)
      relEv.push(prismaEvidence(rel.other.span, `${rel.other.model}.${rel.other.field} is ${rel.other.isList ? "a list (1:n)" : "not a list (1:1)"}`));
    const endIssue = rel.ends.map((e) => modelsByName.get(e.model)?.fields.find((f) => f.name === e.field)?.issues[0]).find((d) => d !== void 0);
    if (endIssue) {
      for (const ruleId of ["DBP001", "DBP004", "DBP005"]) {
        addCheck(ruleId, subject, "unknown", [...relEv], "prisma_field_not_evaluable", endIssue.message);
      }
      continue;
    }
    if (rel.kind === "implicit_many_to_many") {
      addCheck("DBP001", subject, "not_applicable", relEv, "implicit_many_to_many", "implicit many-to-many relations have no owning scalar fields");
    } else if (rel.status === "ambiguous") {
      addCheck("DBP001", subject, "unknown", relEv, "relation_ambiguous", rel.reason ?? "relation could not be resolved");
    } else if (rel.kind === "one_to_many") {
      addCheck("DBP001", subject, "not_applicable", relEv, "not_one_to_one", "relation is 1:n");
    } else if (rel.kind === "one_to_one" && rel.owner && ownerModel) {
      const gate = modelGate(ownerModel);
      if (gate) {
        addCheck("DBP001", subject, gate.status, [...relEv], gate.reasonCode, gate.reason);
      } else {
        const fields = rel.owner.fields;
        const exact = ownerModel.uniques.find((u) => u.fields.length === fields.length && u.fields.every((f, i) => f === fields[i]));
        const ev = [...relEv];
        if (exact?.supported) {
          ev.push(
            prismaEvidence(
              exact.span,
              `${exact.origin === "field" ? `@${exact.kind}` : `@@${exact.kind}`} on ${cols(exact.fields)} matches the relation fields`
            )
          );
          addCheck("DBP001", subject, "pass", ev);
        } else if (exact && !exact.supported) {
          ev.push(prismaEvidence(exact.span, `declaration not evaluated: ${exact.unsupportedReason ?? ""}`));
          addCheck("DBP001", subject, "unknown", ev, "prisma_unique_not_evaluable", exact.unsupportedReason);
        } else {
          const near = ownerModel.uniques.filter((u) => u.fields.some((f) => fields.includes(f)));
          for (const u of near)
            ev.push(
              prismaEvidence(
                u.span,
                `${u.origin === "field" ? `@${u.kind}` : `@@${u.kind}`} on ${cols(u.fields)} does not equal ${cols(fields)} in the same order`
              )
            );
          const c = addCheck("DBP001", subject, "fail", ev, "one_to_one_without_unique_declaration");
          addFinding(
            c,
            "error",
            `1:1 relation ${rel.id} has no Prisma uniqueness declaration on ${cols(fields)}`,
            `relation:${rel.id}`,
            {
              observed: [
                `${rel.owner.model}.${rel.owner.field} declares @relation(fields: ${plist(fields)}).`,
                `The opposite field ${rel.other?.model}.${rel.other?.field} is not a list, so the relation is declared 1:1.`,
                near.length ? `Existing declarations on ${rel.owner.model} (${near.map((u) => cols(u.fields)).join(", ")}) do not match the relation fields exactly.` : `${rel.owner.model} has no @unique/@@unique/@id/@@id on ${cols(fields)}.`
              ],
              expected: fields.length === 1 ? `Prisma ORM 7 requires @unique or @id on ${fields[0]} for the defining side of a 1:1 relation.` : `Prisma ORM 7 requires @@unique or @@id with exactly ${cols(fields)} (same fields, same order) on the defining side of a 1:1 relation.`,
              difference: "The 1:1 relation has no matching uniqueness declaration; prisma validate rejects this schema (P1012).",
              impact: "prisma generate / migrate cannot run on this schema; the intended cardinality (1:1 vs 1:n) is unresolved.",
              notChecked: ["Which cardinality is correct for the business domain is not decided by db-preflight."]
            },
            [
              `If one ${rel.referencedModel} can have several ${rel.owner.model} rows, consider declaring the back-relation as a list (${rel.other?.field} ${rel.owner.model}[]), i.e. 1:n.`,
              "If 1:1 is intended, first confirm the database does not already contain duplicates for these columns, then review adding a matching uniqueness declaration together with a database constraint in a reviewed migration.",
              "Do not add a uniqueness declaration only to silence P1012; see DBP005 for what the database actually enforces."
            ]
          );
        }
      }
    } else {
      addCheck("DBP001", subject, "unknown", relEv, "relation_ambiguous", rel.reason ?? "relation could not be resolved");
    }
    if (rel.kind === "implicit_many_to_many") {
      addCheck("DBP004", subject, "unknown", relEv, "implicit_many_to_many_not_supported", "implicit many-to-many join tables are not checked by v0.1");
    } else if (!rel.owner || !ownerModel || !targetModel || rel.owner.fields.length === 0 || rel.owner.fields.length !== rel.owner.references.length) {
      addCheck("DBP004", subject, "unknown", relEv, "relation_ambiguous", rel.reason ?? "owning side or referenced model could not be resolved");
    } else if (!prisma.datasource || prisma.datasource.relationModeSource === "unknown" || !relMode) {
      addCheck("DBP004", subject, "unknown", relEv, "relation_mode_unknown", "relationMode could not be determined from the scanned files");
    } else if (relMode === "prisma") {
      addCheck(
        "DBP004",
        subject,
        "not_applicable",
        relEv,
        "relation_mode_prisma",
        'relationMode = "prisma": foreign keys are emulated, physical FK absence is expected'
      );
    } else {
      dbp004(rel, subject, relEv, ownerModel, targetModel);
    }
    if (rel.kind !== "one_to_one") {
      if (rel.status === "ambiguous") addCheck("DBP005", subject, "unknown", relEv, "relation_ambiguous", rel.reason ?? "relation could not be resolved");
      else addCheck("DBP005", subject, "not_applicable", relEv, rel.kind === "one_to_many" ? "not_one_to_one" : "implicit_many_to_many", "relation is not 1:1");
    } else if (rel.owner && ownerModel) {
      const gate = modelGate(ownerModel);
      const r = resolutions.get(ownerModel.name);
      const fc = fieldColumns(ownerModel, rel.owner.fields);
      if (gate) addCheck("DBP005", subject, gate.status, [...relEv], gate.reasonCode, gate.reason);
      else if (!fc.ok) addCheck("DBP005", subject, "unknown", [...relEv], "prisma_field_not_evaluable", fc.reason);
      else if (r.status === "unknown") addCheck("DBP005", subject, "unknown", [...relEv], r.reasonCode, r.reason);
      else if (r.status === "missing" || fc.fields.some((f) => missingColumns.get(ownerModel.name)?.has(f.name)))
        addCheck("DBP005", subject, "unknown", [...relEv], "blocked_by_DBP003", "the mapped table or column is missing (see DBP003)");
      else {
        const columns = fc.fields.map((f) => f.dbName);
        const res = evaluateUniqueness(r.table, columns, schemaComplete(r.schema));
        const c = uniquenessCheck("DBP005", subject, [...relEv], r.table, columns, res, ownerModel);
        if (c.status === "fail") {
          const t = r.table;
          const fk = t.foreignKeys.find((k) => k.columns.length === columns.length && k.columns.every((x) => columns.includes(x)));
          addFinding(
            c,
            "error",
            `1:1 relation ${rel.id}: ${t.schema}.${t.name}${cols(columns)} is not unique in the database`,
            `relation:${rel.id}`,
            {
              observed: [
                `Prisma declares ${rel.id} as 1:1 (opposite field ${rel.other?.model}.${rel.other?.field} is not a list).`,
                `${t.schema}.${t.name} has no primary key, unique constraint or valid unique index on ${cols(columns)} or any subset of it.`,
                ...fk ? [
                  `Foreign key ${fk.name} ${cols(fk.columns)} -> ${fk.references.schema}.${fk.references.table}${cols(fk.references.columns)} exists; a foreign key alone does not make the referencing columns unique.`
                ] : []
              ],
              expected: "For a 1:1 relation, the referencing columns are unique in the database (a key on these columns or a subset).",
              difference: `The database structure allows several ${t.name} rows to reference the same ${rel.referencedModel} row.`,
              impact: "The structure permits duplicates that Prisma's 1:1 API cannot represent. This does not mean duplicates currently exist.",
              notChecked: ["Whether duplicate references currently exist (rows are not read).", "Whether 1:1 or 1:n is the intended business rule."]
            },
            [
              `If the business rule is 1:n, review changing the Prisma back-relation to a list; no database change is implied.`,
              "If the business rule is 1:1, a person should first query for existing duplicates, then review a migration that adds a unique constraint on these columns.",
              "Adding UNIQUE is not an automatic fix: it fails if duplicates exist and changes write behaviour."
            ]
          );
        }
      }
    } else {
      addCheck("DBP005", subject, "unknown", relEv, "relation_ambiguous", rel.reason ?? "relation could not be resolved");
    }
  }
  function dbp004(rel, subject, relEv, ownerModel, targetModel) {
    const owner = rel.owner;
    const gate = modelGate(ownerModel) ?? modelGate(targetModel);
    if (gate) {
      addCheck("DBP004", subject, gate.status === "not_applicable" ? "not_applicable" : "unknown", [...relEv], gate.reasonCode, gate.reason);
      return;
    }
    const src = fieldColumns(ownerModel, owner.fields);
    const dst = fieldColumns(targetModel, owner.references);
    if (!src.ok || !dst.ok) {
      addCheck("DBP004", subject, "unknown", [...relEv], "prisma_field_not_evaluable", !src.ok ? src.reason : dst.reason);
      return;
    }
    const r = resolutions.get(ownerModel.name);
    const targetSchema = targetModel.schema ?? defaultSchema;
    if (r.status === "unknown") {
      addCheck("DBP004", subject, "unknown", [...relEv], r.reasonCode, r.reason);
      return;
    }
    if (!targetSchema) {
      addCheck(
        "DBP004",
        subject,
        "unknown",
        [...relEv],
        "default_schema_unknown",
        `referenced model ${targetModel.name} has no @@schema and no --default-schema was given`
      );
      return;
    }
    if (r.status === "missing" || src.fields.some((f) => missingColumns.get(ownerModel.name)?.has(f.name))) {
      addCheck("DBP004", subject, "unknown", [...relEv], "blocked_by_DBP003", "the mapped table or column is missing (see DBP003)");
      return;
    }
    const t = r.table;
    if (t.inheritance.hasInheritanceChildren) {
      addCheck("DBP004", subject, "unknown", [...relEv], "ordinary_inheritance", "foreign keys are not inherited by ordinary (INHERITS) child tables");
      return;
    }
    const srcCols = src.fields.map((f) => f.dbName);
    const dstCols = dst.fields.map((f) => f.dbName);
    const pairKey = (src2, dst2) => src2.map((c2, i) => JSON.stringify([c2, dst2[i]])).sort().join("|");
    const expectedPairs = pairKey(srcCols, dstCols);
    const ev = [...relEv];
    const targetName = targetModel.dbName;
    const sameTarget = t.foreignKeys.filter((k) => k.references.schema === targetSchema && k.references.table === targetName);
    const exact = sameTarget.find((k) => k.columns.length === srcCols.length && pairKey(k.columns, k.references.columns) === expectedPairs);
    const expectedText = `${t.schema}.${t.name}${cols(srcCols)} -> ${targetSchema}.${targetName}${cols(dstCols)}`;
    if (exact) {
      ev.push(
        tableEvidence(
          t,
          `foreign key ${exact.name} ${cols(exact.columns)} -> ${exact.references.schema}.${exact.references.table}${cols(exact.references.columns)}`,
          {
            constraint: exact.name,
            columns: exact.columns
          }
        )
      );
      if (!exact.validated) {
        addCheck("DBP004", subject, "unknown", ev, "fk_not_validated", `foreign key ${exact.name} is NOT VALID (existing rows were not checked)`);
        return;
      }
      if (!exact.enforced) {
        addCheck("DBP004", subject, "unknown", ev, "fk_not_enforced", `foreign key ${exact.name} is NOT ENFORCED`);
        return;
      }
      if (exact.period) {
        addCheck(
          "DBP004",
          subject,
          "unknown",
          ev,
          "fk_period_not_supported",
          `foreign key ${exact.name} is a temporal (PERIOD) foreign key, whose semantics v0.1 does not evaluate`
        );
        return;
      }
      addCheck("DBP004", subject, "pass", ev);
      return;
    }
    const tr = resolutions.get(targetModel.name);
    if (tr.status !== "found") {
      addCheck(
        "DBP004",
        subject,
        "unknown",
        ev,
        "reference_not_resolved",
        tr.status === "unknown" ? `referenced model ${targetModel.name}: ${tr.reason}` : `referenced table ${tr.schema}.${tr.name} was not found (see DBP003)`
      );
      return;
    }
    const srcSet = new Set(srcCols);
    const related = t.foreignKeys.filter((k) => k.columns.length === srcCols.length && k.columns.every((c2) => srcSet.has(c2)) || sameTarget.includes(k));
    if (!schemaComplete(t.schema)) {
      addCheck("DBP004", subject, "unknown", ev, "incomplete_collection", `metadata collection for schema "${t.schema}" was incomplete`);
      return;
    }
    for (const k of related) {
      ev.push(
        tableEvidence(
          t,
          `foreign key ${k.name} ${cols(k.columns)} -> ${k.references.schema}.${k.references.table}${cols(k.references.columns)} does not match`,
          {
            constraint: k.name,
            columns: k.columns
          }
        )
      );
    }
    const mismatch = related.length > 0;
    const c = addCheck("DBP004", subject, "fail", ev, mismatch ? "fk_mapping_mismatch" : "fk_missing");
    addFinding(
      c,
      "error",
      mismatch ? `Foreign key for ${rel.id} has a different column mapping` : `Expected foreign key for ${rel.id} was not found`,
      `relation:${rel.id}`,
      {
        observed: [
          `Prisma relation ${rel.id} expects ${expectedText} (relationMode = foreignKeys${prisma.datasource?.relationModeSource === "default" ? ", the default" : ""}).`,
          mismatch ? `Related foreign key(s) exist but pair the columns differently or point elsewhere: ${related.map((k) => `${k.name} ${cols(k.columns)} -> ${k.references.schema}.${k.references.table}${cols(k.references.columns)}`).join("; ")}.` : `${t.schema}.${t.name} has no foreign key to ${targetSchema}.${targetName}.`
        ],
        expected: `A foreign key with the column pairs ${srcCols.map((c2, i) => `${c2}->${dstCols[i]}`).join(", ")}.`,
        difference: mismatch ? "The column correspondence differs from the Prisma relation." : "No database foreign key enforces this relation.",
        impact: mismatch ? "Joins generated by Prisma follow a different column pairing than the database enforces." : "Referential integrity for this relation is not enforced by the database.",
        notChecked: ["Whether orphaned rows currently exist (rows are not read)."]
      },
      [
        'If referential integrity is intentionally handled by the application, review setting relationMode = "prisma" (this does not change the database).',
        "If a foreign key is intended, check for orphaned rows before reviewing a migration that adds it.",
        mismatch ? "Compare the order of fields/references in @relation with the database constraint definition." : "Confirm the scanned database is the environment this schema targets."
      ]
    );
  }
  checks.sort((a, b) => compareStrings(a.ruleId, b.ruleId) || compareStrings(a.subject, b.subject));
  const byId = new Map(findings.map((f) => [f.id, f]));
  for (const f of findings) {
    if (f.ruleId !== "DBP005") continue;
    const relId = f.groupId.slice("relation:".length);
    const rel = prisma.relations.find((r) => r.id === relId);
    const d1 = findings.find((x) => x.ruleId === "DBP001" && x.groupId === f.groupId);
    if (d1) link(f, d1);
    if (rel?.owner) {
      const d2check = dbp002BySubject.get(`${rel.owner.model}|${rel.owner.fields.join(",")}`);
      const d2 = d2check?.findingId ? byId.get(d2check.findingId) : void 0;
      if (d2) {
        d2.groupId = f.groupId;
        link(f, d2);
      }
    }
  }
  function link(a, b) {
    if (!a.relatedFindingIds.includes(b.id)) a.relatedFindingIds.push(b.id);
    if (!b.relatedFindingIds.includes(a.id)) b.relatedFindingIds.push(a.id);
    a.relatedFindingIds.sort(compareStrings);
    b.relatedFindingIds.sort(compareStrings);
  }
  const ruleOrder = (r) => ["DBP001", "DBP002", "DBP005", "DBP004", "DBP003", "DBP006"].indexOf(r);
  findings.sort((a, b) => compareStrings(a.groupId, b.groupId) || ruleOrder(a.ruleId) - ruleOrder(b.ruleId) || compareStrings(a.subject, b.subject));
  const groupsMap = /* @__PURE__ */ new Map();
  for (const f of findings) groupsMap.set(f.groupId, [...groupsMap.get(f.groupId) ?? [], f]);
  const findingGroups = [...groupsMap.entries()].map(([groupId, list]) => ({
    groupId,
    title: groupTitle(groupId, list),
    findingIds: list.map((f) => f.id)
  })).sort((a, b) => compareStrings(a.groupId, b.groupId));
  const blockingDiagnostics = prisma.diagnostics.filter((d) => d.severity === "blocking").length;
  const anyFail = checks.some((c) => c.status === "fail");
  const anyUnknown = checks.some((c) => c.status === "unknown");
  const completeWithinScope = !anyUnknown && blockingDiagnostics === 0 && dbComplete;
  const resultStatus = anyFail ? "mismatch_found" : completeWithinScope ? "no_mismatch_in_checked_scope" : "inconclusive";
  const exitCode = anyFail ? 1 : completeWithinScope ? 0 : 3;
  return { checks, findings, findingGroups, resultStatus, exitCode, blockingDiagnostics, completeWithinScope };
}
function groupTitle(groupId, list) {
  if (groupId.startsWith("relation:")) {
    const rules = [...new Set(list.map((f) => f.ruleId))].join(" + ");
    return `Relation ${groupId.slice("relation:".length)} (${rules}${list.length > 1 ? ": one shared root cause" : ""})`;
  }
  if (groupId.startsWith("model:")) return `Model ${groupId.slice("model:".length)}`;
  return groupId;
}

// src/core/version.ts
var TOOL_VERSION = true ? "0.1.0" : "0.1.0";
var SNAPSHOT_VERSION = 1;

// src/core/report.ts
var DISCLAIMER = "Results cover only the supported checks listed in this report, evaluated against the collected metadata. They are not a guarantee that the database as a whole is correct, that data is consistent, or that any migration is safe.";
function buildReport(input) {
  const { prisma, db } = input;
  const out = runEngine({ prisma, db, defaultSchema: input.defaultSchema });
  const totals = { checks: out.checks.length, pass: 0, fail: 0, unknown: 0, not_applicable: 0 };
  const unknownReasons = /* @__PURE__ */ new Map();
  for (const c of out.checks) {
    totals[c.status]++;
    if (c.status === "unknown") {
      const key2 = c.reasonCode ?? "unspecified";
      const prev = unknownReasons.get(key2);
      unknownReasons.set(key2, { count: (prev?.count ?? 0) + 1, example: prev?.example ?? `${c.subject}: ${c.reason ?? ""}` });
    }
  }
  const groups = out.findingGroups.length;
  let summary;
  if (out.resultStatus === "mismatch_found") {
    summary = `${totals.fail} check(s) found confirmed mismatches, grouped into ${groups} root-cause group(s).`;
    if (totals.unknown > 0 || !out.completeWithinScope) summary += ` Coverage is incomplete: ${totals.unknown} check(s) are unknown.`;
  } else if (out.resultStatus === "inconclusive") {
    summary = `No confirmed mismatches, but ${totals.unknown} required check(s) are unknown${out.blockingDiagnostics ? ` and ${out.blockingDiagnostics} Prisma construct(s) could not be evaluated` : ""}${db.complete ? "" : " and database metadata collection was incomplete"}; no conclusion can be drawn.`;
  } else {
    summary = `No mismatches found in the ${totals.pass} supported check(s) that passed (${totals.not_applicable} not applicable).`;
  }
  const ds = prisma.datasource;
  return {
    reportVersion: 1,
    toolVersion: TOOL_VERSION,
    generatedAt: input.generatedAt,
    mode: input.mode,
    scope: { dbSchemas: [...db.requestedSchemas], defaultSchema: input.defaultSchema, rules: RULE_IDS },
    prisma: {
      ormMajorAssumed: 7,
      inputKind: input.inputKind,
      files: prisma.files,
      skipped: prisma.skipped,
      datasource: {
        found: !!ds,
        provider: ds?.provider ?? null,
        relationMode: ds?.relationMode ?? null,
        relationModeSource: ds?.relationModeSource ?? "unknown",
        schemas: ds?.schemas ?? null
      },
      counts: {
        models: prisma.models.filter((m) => m.blockKind === "model").length,
        views: prisma.models.filter((m) => m.blockKind === "view").length,
        enums: prisma.enums.length,
        relations: prisma.relations.length
      },
      diagnostics: prisma.diagnostics
    },
    database: {
      source: db.origin,
      snapshotOrigin: db.snapshotOrigin ?? null,
      collectedAt: db.collectedAt,
      serverVersion: db.server.version,
      requestedSchemas: db.requestedSchemas,
      schemasFound: db.schemasFound,
      collectionComplete: db.complete,
      gaps: db.gaps,
      note: db.origin === "live" ? "Metadata was read from the live catalog at collectedAt." : db.origin === "demo" ? "Built-in synthetic demo metadata; no database was contacted." : "Metadata comes from a snapshot taken at collectedAt; it may not reflect the database's current state."
    },
    result: { status: out.resultStatus, exitCode: out.exitCode, summary, disclaimer: DISCLAIMER },
    checks: out.checks,
    findings: out.findings,
    findingGroups: out.findingGroups,
    coverage: {
      totals,
      unknownReasons: [...unknownReasons.entries()].map(([reasonCode, v]) => ({ reasonCode, count: v.count, example: v.example })).sort((a, b) => a.reasonCode < b.reasonCode ? -1 : a.reasonCode > b.reasonCode ? 1 : 0),
      blockingDiagnostics: out.blockingDiagnostics,
      completeWithinScope: out.completeWithinScope,
      notCovered: NOT_COVERED
    },
    safety: { ...input.safety, prismaInputsUnchangedVerified: false, llmOrNetworkCalls: "none" }
  };
}

// src/demo/data.ts
var DEMO_SCENARIOS = {
  broken: {
    fixture: "composite-one-to-one-mismatch",
    defaultSchema: "public",
    inputKind: "directory",
    sources: [
      {
        "path": "base.prisma",
        "text": '// Synthetic fixture. All model names and data are invented.\ndatasource db {\n  provider = "postgresql"\n}\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../generated/client"\n}\n'
      },
      {
        "path": "organization.prisma",
        "text": 'model Organization {\n  id        Int               @id @default(autoincrement())\n  name      String\n  snapshots MonthlySnapshot[]\n\n  @@map("organizations")\n}\n'
      },
      {
        "path": "reporting.prisma",
        "text": '/// Parent: one row per (organization, month, snapshot). The composite key is unique.\nmodel MonthlySnapshot {\n  organizationId Int      @map("organization_id")\n  month          String   @db.Char(7)\n  snapshotId     Int      @map("snapshot_id")\n  createdAt      DateTime @default(now()) @map("created_at")\n\n  organization Organization     @relation(fields: [organizationId], references: [id])\n  summary      SnapshotSummary? // back-relation is NOT a list => declared 1:1\n\n  @@id([organizationId, month, snapshotId])\n  @@map("monthly_snapshots")\n}\n\n/// Child: declared 1:1, but [organizationId, month, snapshotId] has no uniqueness\n/// declaration here (Prisma 7 rejects this with P1012) and no unique key in the DB.\nmodel SnapshotSummary {\n  id             Int     @id @default(autoincrement())\n  organizationId Int     @map("organization_id")\n  month          String  @db.Char(7)\n  snapshotId     Int     @map("snapshot_id")\n  totalAmount    Decimal @map("total_amount") @db.Decimal(12, 2)\n  note           String? // "strings // with comment markers" are not comments\n\n  snapshot MonthlySnapshot @relation(fields: [organizationId, month, snapshotId], references: [organizationId, month, snapshotId], onDelete: Cascade)\n\n  @@index([organizationId, month, snapshotId])\n  @@map("snapshot_summaries")\n}\n'
      }
    ],
    snapshot: { "snapshotVersion": 1, "generator": { "name": "db-preflight", "version": "0.1.0" }, "origin": "synthetic", "collectedAt": "2026-01-15T09:00:00.000Z", "server": { "version": "16.4", "versionNum": 160004 }, "requestedSchemas": ["public"], "schemasFound": ["public"], "complete": true, "gaps": [], "readOnly": { "verified": false, "detail": "synthetic fixture; no database connection" }, "tables": [{ "schema": "public", "name": "monthly_snapshots", "kind": "table", "inheritance": { "isPartition": false, "hasInheritanceChildren": false, "inheritsFrom": [] }, "columns": [{ "name": "organization_id", "nullable": false }, { "name": "month", "nullable": false }, { "name": "snapshot_id", "nullable": false }, { "name": "created_at", "nullable": false }], "uniqueKeys": [{ "kind": "primary_key", "name": "monthly_snapshots_pkey", "columns": ["organization_id", "month", "snapshot_id"], "includeColumns": [], "partial": false, "expression": false, "valid": true, "deferrable": false, "immediate": true, "nullsNotDistinct": false, "period": false }], "foreignKeys": [{ "name": "monthly_snapshots_organization_id_fkey", "columns": ["organization_id"], "references": { "schema": "public", "table": "organizations", "columns": ["id"] }, "deferrable": false, "validated": true, "enforced": true }] }, { "schema": "public", "name": "organizations", "kind": "table", "inheritance": { "isPartition": false, "hasInheritanceChildren": false, "inheritsFrom": [] }, "columns": [{ "name": "id", "nullable": false }, { "name": "name", "nullable": false }], "uniqueKeys": [{ "kind": "primary_key", "name": "organizations_pkey", "columns": ["id"], "includeColumns": [], "partial": false, "expression": false, "valid": true, "deferrable": false, "immediate": true, "nullsNotDistinct": false, "period": false }], "foreignKeys": [] }, { "schema": "public", "name": "snapshot_summaries", "kind": "table", "inheritance": { "isPartition": false, "hasInheritanceChildren": false, "inheritsFrom": [] }, "columns": [{ "name": "id", "nullable": false }, { "name": "organization_id", "nullable": false }, { "name": "month", "nullable": false }, { "name": "snapshot_id", "nullable": false }, { "name": "total_amount", "nullable": false }, { "name": "note", "nullable": true }], "uniqueKeys": [{ "kind": "primary_key", "name": "snapshot_summaries_pkey", "columns": ["id"], "includeColumns": [], "partial": false, "expression": false, "valid": true, "deferrable": false, "immediate": true, "nullsNotDistinct": false, "period": false }], "foreignKeys": [{ "name": "snapshot_summaries_snapshot_fkey", "columns": ["organization_id", "month", "snapshot_id"], "references": { "schema": "public", "table": "monthly_snapshots", "columns": ["organization_id", "month", "snapshot_id"] }, "deferrable": false, "validated": true, "enforced": true }] }], "otherRelations": [] }
  },
  healthy: {
    fixture: "healthy",
    defaultSchema: "public",
    inputKind: "file",
    sources: [
      {
        "path": "schema.prisma",
        "text": '// Synthetic fixture: the composite 1:1 relation is declared correctly and enforced by the database.\ndatasource db {\n  provider = "postgresql"\n}\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../generated/client"\n}\n\nmodel Organization {\n  id        Int               @id @default(autoincrement())\n  name      String\n  snapshots MonthlySnapshot[]\n\n  @@map("organizations")\n}\n\nmodel MonthlySnapshot {\n  organizationId Int      @map("organization_id")\n  month          String   @db.Char(7)\n  snapshotId     Int      @map("snapshot_id")\n  createdAt      DateTime @default(now()) @map("created_at")\n\n  organization Organization     @relation(fields: [organizationId], references: [id])\n  summary      SnapshotSummary?\n\n  @@id([organizationId, month, snapshotId])\n  @@map("monthly_snapshots")\n}\n\nmodel SnapshotSummary {\n  id             Int     @id @default(autoincrement())\n  organizationId Int     @map("organization_id")\n  month          String  @db.Char(7)\n  snapshotId     Int     @map("snapshot_id")\n  totalAmount    Decimal @map("total_amount") @db.Decimal(12, 2)\n  note           String?\n\n  snapshot MonthlySnapshot @relation(fields: [organizationId, month, snapshotId], references: [organizationId, month, snapshotId], onDelete: Cascade)\n\n  @@unique([organizationId, month, snapshotId])\n  @@map("snapshot_summaries")\n}\n'
      }
    ],
    snapshot: { "snapshotVersion": 1, "generator": { "name": "db-preflight", "version": "0.1.0" }, "origin": "synthetic", "collectedAt": "2026-01-15T09:00:00.000Z", "server": { "version": "16.4", "versionNum": 160004 }, "requestedSchemas": ["public"], "schemasFound": ["public"], "complete": true, "gaps": [], "readOnly": { "verified": false, "detail": "synthetic fixture; no database connection" }, "tables": [{ "schema": "public", "name": "monthly_snapshots", "kind": "table", "inheritance": { "isPartition": false, "hasInheritanceChildren": false, "inheritsFrom": [] }, "columns": [{ "name": "organization_id", "nullable": false }, { "name": "month", "nullable": false }, { "name": "snapshot_id", "nullable": false }, { "name": "created_at", "nullable": false }], "uniqueKeys": [{ "kind": "primary_key", "name": "monthly_snapshots_pkey", "columns": ["organization_id", "month", "snapshot_id"], "includeColumns": [], "partial": false, "expression": false, "valid": true, "deferrable": false, "immediate": true, "nullsNotDistinct": false, "period": false }], "foreignKeys": [{ "name": "monthly_snapshots_organization_id_fkey", "columns": ["organization_id"], "references": { "schema": "public", "table": "organizations", "columns": ["id"] }, "deferrable": false, "validated": true, "enforced": true }] }, { "schema": "public", "name": "organizations", "kind": "table", "inheritance": { "isPartition": false, "hasInheritanceChildren": false, "inheritsFrom": [] }, "columns": [{ "name": "id", "nullable": false }, { "name": "name", "nullable": false }], "uniqueKeys": [{ "kind": "primary_key", "name": "organizations_pkey", "columns": ["id"], "includeColumns": [], "partial": false, "expression": false, "valid": true, "deferrable": false, "immediate": true, "nullsNotDistinct": false, "period": false }], "foreignKeys": [] }, { "schema": "public", "name": "snapshot_summaries", "kind": "table", "inheritance": { "isPartition": false, "hasInheritanceChildren": false, "inheritsFrom": [] }, "columns": [{ "name": "id", "nullable": false }, { "name": "organization_id", "nullable": false }, { "name": "month", "nullable": false }, { "name": "snapshot_id", "nullable": false }, { "name": "total_amount", "nullable": false }, { "name": "note", "nullable": true }], "uniqueKeys": [{ "kind": "unique_constraint", "name": "snapshot_summaries_organization_id_month_snapshot_id_key", "columns": ["organization_id", "month", "snapshot_id"], "includeColumns": [], "partial": false, "expression": false, "valid": true, "deferrable": false, "immediate": true, "nullsNotDistinct": false, "period": false }, { "kind": "primary_key", "name": "snapshot_summaries_pkey", "columns": ["id"], "includeColumns": [], "partial": false, "expression": false, "valid": true, "deferrable": false, "immediate": true, "nullsNotDistinct": false, "period": false }], "foreignKeys": [{ "name": "snapshot_summaries_snapshot_fkey", "columns": ["organization_id", "month", "snapshot_id"], "references": { "schema": "public", "table": "monthly_snapshots", "columns": ["organization_id", "month", "snapshot_id"] }, "deferrable": false, "validated": true, "enforced": true }] }], "otherRelations": [] }
  }
};

// src/postgres/connection.ts
var ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
var DEFAULT_URL_ENV = "DB_PREFLIGHT_DATABASE_URL";
var ALLOWED_PARAMS = /* @__PURE__ */ new Set(["sslmode", "sslrootcert", "schema"]);
function isLoopback(host) {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  return h === "localhost" || h === "::1" || /^127(\.\d{1,3}){3}$/.test(h);
}
function validateEnvName(name) {
  if (!ENV_NAME_PATTERN.test(name) || name.length > 128) {
    throw new DbpError("BAD_ENV_NAME", "--db-url-env must be an environment variable NAME (letters, digits, underscore), not a URL or value");
  }
  return name;
}
function parseDatabaseUrl(raw, envName) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new DbpError("BAD_DATABASE_URL", `the value of ${envName} is not a valid URL (value not shown)`);
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new DbpError("BAD_DATABASE_URL", `the value of ${envName} must use the postgres:// or postgresql:// scheme`);
  }
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  if (!host) {
    throw new DbpError("INCOMPLETE_DATABASE_URL", `the value of ${envName} has no host; db-preflight does not fall back to PGHOST or sockets`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database || database.includes("/")) {
    throw new DbpError("INCOMPLETE_DATABASE_URL", `the value of ${envName} has no database name; db-preflight does not fall back to PGDATABASE`);
  }
  const user = decodeURIComponent(url.username);
  if (!user) {
    throw new DbpError("INCOMPLETE_DATABASE_URL", `the value of ${envName} has no user name; db-preflight does not fall back to PGUSER`);
  }
  const port = url.port ? Number.parseInt(url.port, 10) : 5432;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new DbpError("BAD_DATABASE_URL", `the value of ${envName} has an invalid port`);
  }
  let password = null;
  if (url.password) {
    try {
      password = decodeURIComponent(url.password);
    } catch {
      throw new DbpError("BAD_DATABASE_URL", `the password in ${envName} is not valid percent-encoding (value not shown)`);
    }
  }
  const unknown = [...new Set([...url.searchParams.keys()].filter((k) => !ALLOWED_PARAMS.has(k)))];
  if (unknown.length > 0) {
    throw new DbpError(
      "UNSUPPORTED_URL_PARAMETER",
      `unsupported connection parameter(s) in ${envName}: ${unknown.map((k) => k.replace(/[^A-Za-z0-9_-]/g, "?").slice(0, 40)).join(", ")} (allowed: sslmode, sslrootcert, schema)`
    );
  }
  const loopback = isLoopback(host);
  const warnings = [];
  const sslParam = url.searchParams.get("sslmode");
  let sslMode;
  switch (sslParam) {
    case null:
      sslMode = loopback ? "disable" : "verify-full";
      break;
    case "disable":
      sslMode = "disable";
      if (!loopback) warnings.push("sslmode=disable for a non-loopback host: the connection (including the password) is not encrypted");
      break;
    case "require":
    case "verify-full":
      sslMode = "verify-full";
      break;
    case "verify-ca":
      sslMode = "verify-ca";
      break;
    default:
      throw new DbpError("UNSUPPORTED_SSLMODE", `sslmode in ${envName} must be one of disable, require (treated as verify-full), verify-ca, verify-full`);
  }
  if (url.searchParams.has("schema")) {
    warnings.push("the 'schema' URL parameter is ignored; use --schemas and --default-schema");
  }
  return {
    host,
    port,
    database,
    user,
    password,
    sslMode,
    sslRootCertPath: url.searchParams.get("sslrootcert"),
    loopback,
    warnings
  };
}
function targetSecrets(raw, t) {
  const s = [raw];
  if (t?.password) s.push(t.password);
  return s;
}

// src/postgres/live.ts
var import_node_child_process = require("node:child_process");
var import_node_fs2 = require("node:fs");

// src/postgres/queries.ts
var QUERIES = {
  begin: "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  setSearchPath: "SET LOCAL search_path = pg_catalog, pg_temp",
  sessionInfo: `SELECT pg_catalog.current_setting('transaction_read_only') AS read_only,
       pg_catalog.current_setting('transaction_isolation') AS isolation,
       pg_catalog.current_setting('server_version_num') AS version_num,
       pg_catalog.current_setting('server_version') AS version,
       pg_catalog.current_setting('statement_timeout') AS statement_timeout,
       (SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname OPERATOR(pg_catalog.=) CURRENT_USER) AS is_superuser`,
  schemas: `SELECT n.nspname::pg_catalog.text AS schema_name
FROM pg_catalog.pg_namespace n
WHERE n.nspname::pg_catalog.text OPERATOR(pg_catalog.=) ANY ($1::pg_catalog.text[])`,
  relations: `SELECT n.nspname::pg_catalog.text AS schema_name,
       c.relname::pg_catalog.text AS rel_name,
       c.relkind::pg_catalog.text AS relkind,
       c.relispartition AS is_partition,
       EXISTS (SELECT 1 FROM pg_catalog.pg_inherits i
               JOIN pg_catalog.pg_class ch ON ch.oid OPERATOR(pg_catalog.=) i.inhrelid
               WHERE i.inhparent OPERATOR(pg_catalog.=) c.oid AND NOT ch.relispartition) AS has_inheritance_children,
       ARRAY(SELECT pn.nspname::pg_catalog.text FROM pg_catalog.pg_inherits i
             JOIN pg_catalog.pg_class pc ON pc.oid OPERATOR(pg_catalog.=) i.inhparent
             JOIN pg_catalog.pg_namespace pn ON pn.oid OPERATOR(pg_catalog.=) pc.relnamespace
             WHERE i.inhrelid OPERATOR(pg_catalog.=) c.oid AND NOT c.relispartition ORDER BY i.inhseqno) AS parent_schemas,
       ARRAY(SELECT pc.relname::pg_catalog.text FROM pg_catalog.pg_inherits i
             JOIN pg_catalog.pg_class pc ON pc.oid OPERATOR(pg_catalog.=) i.inhparent
             WHERE i.inhrelid OPERATOR(pg_catalog.=) c.oid AND NOT c.relispartition ORDER BY i.inhseqno) AS parent_tables
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid OPERATOR(pg_catalog.=) c.relnamespace
WHERE n.nspname::pg_catalog.text OPERATOR(pg_catalog.=) ANY ($1::pg_catalog.text[])
  AND c.relkind::pg_catalog.text OPERATOR(pg_catalog.=) ANY (ARRAY['r','p','v','m','f']::pg_catalog.text[])`,
  columns: `SELECT n.nspname::pg_catalog.text AS schema_name,
       c.relname::pg_catalog.text AS rel_name,
       a.attname::pg_catalog.text AS column_name,
       a.attnum::pg_catalog.int4 AS attnum,
       a.attnotnull AS not_null,
       false AS not_null_unvalidated,
       (ty.typtype::pg_catalog.text OPERATOR(pg_catalog.=) 'd') AS is_domain
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_type ty ON ty.oid OPERATOR(pg_catalog.=) a.atttypid
JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid OPERATOR(pg_catalog.=) c.relnamespace
WHERE n.nspname::pg_catalog.text OPERATOR(pg_catalog.=) ANY ($1::pg_catalog.text[])
  AND c.relkind::pg_catalog.text OPERATOR(pg_catalog.=) ANY (ARRAY['r','p']::pg_catalog.text[])
  AND a.attnum OPERATOR(pg_catalog.>) 0 AND NOT a.attisdropped`,
  // PostgreSQL 18 can store NOT NULL constraints as NOT VALID (existing rows unchecked).
  columnsV18: `SELECT n.nspname::pg_catalog.text AS schema_name,
       c.relname::pg_catalog.text AS rel_name,
       a.attname::pg_catalog.text AS column_name,
       a.attnum::pg_catalog.int4 AS attnum,
       a.attnotnull AS not_null,
       EXISTS (SELECT 1 FROM pg_catalog.pg_constraint con
               WHERE con.conrelid OPERATOR(pg_catalog.=) a.attrelid
                 AND con.contype::pg_catalog.text OPERATOR(pg_catalog.=) 'n'
                 AND con.conkey[1] OPERATOR(pg_catalog.=) a.attnum
                 AND NOT con.convalidated) AS not_null_unvalidated,
       (ty.typtype::pg_catalog.text OPERATOR(pg_catalog.=) 'd') AS is_domain
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_type ty ON ty.oid OPERATOR(pg_catalog.=) a.atttypid
JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid OPERATOR(pg_catalog.=) c.relnamespace
WHERE n.nspname::pg_catalog.text OPERATOR(pg_catalog.=) ANY ($1::pg_catalog.text[])
  AND c.relkind::pg_catalog.text OPERATOR(pg_catalog.=) ANY (ARRAY['r','p']::pg_catalog.text[])
  AND a.attnum OPERATOR(pg_catalog.>) 0 AND NOT a.attisdropped`,
  constraints: constraintsQuery("true AS conenforced, false AS conperiod"),
  constraintsV18: constraintsQuery("con.conenforced AS conenforced, con.conperiod AS conperiod"),
  indexes: indexesQuery("false AS nulls_not_distinct"),
  indexesV15: indexesQuery("i.indnullsnotdistinct AS nulls_not_distinct"),
  rollback: "ROLLBACK"
};
function constraintsQuery(versionColumns) {
  return `SELECT n.nspname::pg_catalog.text AS schema_name,
       c.relname::pg_catalog.text AS rel_name,
       con.conname::pg_catalog.text AS con_name,
       con.contype::pg_catalog.text AS contype,
       con.condeferrable, con.condeferred, con.convalidated, ${versionColumns},
       con.conindid::pg_catalog.int8::pg_catalog.text AS index_oid,
       ARRAY(SELECT COALESCE(a.attname::pg_catalog.text, '')
             FROM pg_catalog.unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
             LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid OPERATOR(pg_catalog.=) con.conrelid AND a.attnum OPERATOR(pg_catalog.=) k.attnum
             ORDER BY k.ord) AS columns,
       rn.nspname::pg_catalog.text AS ref_schema,
       rc.relname::pg_catalog.text AS ref_table,
       ARRAY(SELECT COALESCE(a.attname::pg_catalog.text, '')
             FROM pg_catalog.unnest(con.confkey) WITH ORDINALITY AS k(attnum, ord)
             LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid OPERATOR(pg_catalog.=) con.confrelid AND a.attnum OPERATOR(pg_catalog.=) k.attnum
             ORDER BY k.ord) AS ref_columns
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid OPERATOR(pg_catalog.=) c.relnamespace
LEFT JOIN pg_catalog.pg_class rc ON rc.oid OPERATOR(pg_catalog.=) con.confrelid
LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid OPERATOR(pg_catalog.=) rc.relnamespace
WHERE n.nspname::pg_catalog.text OPERATOR(pg_catalog.=) ANY ($1::pg_catalog.text[])
  AND con.contype::pg_catalog.text OPERATOR(pg_catalog.=) ANY (ARRAY['p','u','f','x']::pg_catalog.text[])
  AND (con.conparentid OPERATOR(pg_catalog.=) 0
       OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint pcon
                      WHERE pcon.oid OPERATOR(pg_catalog.=) con.conparentid
                        AND pcon.conrelid OPERATOR(pg_catalog.=) con.conrelid))`;
}
function indexesQuery(nullsColumn) {
  return `SELECT n.nspname::pg_catalog.text AS schema_name,
       c.relname::pg_catalog.text AS rel_name,
       ic.relname::pg_catalog.text AS index_name,
       i.indexrelid::pg_catalog.int8::pg_catalog.text AS index_oid,
       i.indisprimary, i.indisvalid, i.indisready, i.indislive, i.indimmediate,
       i.indnkeyatts::pg_catalog.int4 AS indnkeyatts,
       (i.indexprs IS NOT NULL) AS has_expressions,
       (i.indpred IS NOT NULL) AS is_partial,
       ${nullsColumn},
       ARRAY(SELECT COALESCE(a.attname::pg_catalog.text, '')
             FROM pg_catalog.unnest(i.indkey::pg_catalog.int2[]) WITH ORDINALITY AS k(attnum, ord)
             LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid OPERATOR(pg_catalog.=) i.indrelid AND a.attnum OPERATOR(pg_catalog.=) k.attnum
             ORDER BY k.ord) AS columns
FROM pg_catalog.pg_index i
JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) i.indrelid
JOIN pg_catalog.pg_namespace n ON n.oid OPERATOR(pg_catalog.=) c.relnamespace
JOIN pg_catalog.pg_class ic ON ic.oid OPERATOR(pg_catalog.=) i.indexrelid
WHERE n.nspname::pg_catalog.text OPERATOR(pg_catalog.=) ANY ($1::pg_catalog.text[])
  AND i.indisunique
  AND c.relkind::pg_catalog.text OPERATOR(pg_catalog.=) ANY (ARRAY['r','p']::pg_catalog.text[])`;
}
var ALLOWED_SQL = new Set(Object.values(QUERIES));

// src/postgres/collector.ts
var MIN_SERVER_VERSION_NUM = 14e4;
var asStr = (v) => typeof v === "string" ? v : String(v);
var asBool = (v) => v === true;
var asStrArr = (v) => Array.isArray(v) ? v.map(asStr) : [];
async function collectCatalog(client, schemas, now = () => /* @__PURE__ */ new Date()) {
  const executed = [];
  const run = async (id, params) => {
    executed.push(id);
    const res = await client.query(QUERIES[id], params);
    return res.rows;
  };
  const requested = [...new Set(schemas)].sort(compareStrings);
  const base = {
    origin: "live",
    collectedAt: now().toISOString(),
    server: { version: null, versionNum: null },
    requestedSchemas: requested,
    schemasFound: [],
    complete: false,
    gaps: [],
    tables: [],
    otherRelations: [],
    readOnly: { verified: false, detail: "not yet verified" }
  };
  let began = false;
  try {
    await run("begin");
    began = true;
    await run("setSearchPath");
    const info = (await run("sessionInfo"))[0] ?? {};
    if (info.read_only !== "on") {
      throw new DbpError("READ_ONLY_NOT_VERIFIED", "transaction_read_only is not 'on'; aborting before reading the catalog");
    }
    if (asStr(info.isolation) !== "repeatable read") {
      throw new DbpError("ISOLATION_NOT_VERIFIED", "transaction isolation is not REPEATABLE READ; aborting");
    }
    if (info.is_superuser === true) {
      throw new DbpError(
        "SUPERUSER_REJECTED",
        "the connection role is a superuser; live scans require a least-privilege read-only role (see docs/security.md)"
      );
    }
    if (info.is_superuser !== false) {
      throw new DbpError("ROLE_NOT_VERIFIED", "could not verify that the connection role is not a superuser; aborting");
    }
    base.readOnly = { verified: true, detail: "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; transaction_read_only = on" };
    const versionNum = Number.parseInt(asStr(info.version_num), 10);
    base.server = { version: typeof info.version === "string" ? info.version : null, versionNum: Number.isFinite(versionNum) ? versionNum : null };
    const statementTimeout = typeof info.statement_timeout === "string" ? info.statement_timeout : null;
    if (!Number.isFinite(versionNum) || versionNum < MIN_SERVER_VERSION_NUM) {
      base.gaps.push({ scope: "*", reason: `server version ${base.server.version ?? "unknown"} is not supported (minimum 14); catalog not collected` });
      return { db: base, executed, readOnlyVerified: true, statementTimeout };
    }
    try {
      base.schemasFound = (await run("schemas", [requested])).map((r) => asStr(r.schema_name)).sort(compareStrings);
      const relRows = await run("relations", [requested]);
      const colRows = await run(versionNum >= 18e4 ? "columnsV18" : "columns", [requested]);
      const conRows = await run(versionNum >= 18e4 ? "constraintsV18" : "constraints", [requested]);
      const idxRows = await run(versionNum >= 15e4 ? "indexesV15" : "indexes", [requested]);
      const built = normalize(relRows, colRows, conRows, idxRows);
      base.tables = built.tables;
      base.otherRelations = built.others;
      base.gaps.push(...built.gaps);
      base.complete = built.gaps.length === 0;
    } catch (e) {
      if (e instanceof DbpError) throw e;
      const first = describeError(e)[0];
      base.tables = [];
      base.otherRelations = [];
      base.gaps.push({ scope: "*", reason: `catalog query ${executed[executed.length - 1]} failed${first?.code ? ` (SQLSTATE ${first.code})` : ""}` });
      base.complete = false;
    }
    return { db: base, executed, readOnlyVerified: true, statementTimeout };
  } finally {
    if (began) {
      try {
        await run("rollback");
      } catch {
      }
    }
  }
}
function key(schema, table) {
  return JSON.stringify([schema, table]);
}
function normalize(relRows, colRows, conRows, idxRows) {
  const tables = /* @__PURE__ */ new Map();
  const others = [];
  const gaps = [];
  for (const r of relRows) {
    const schema = asStr(r.schema_name);
    const name = asStr(r.rel_name);
    const kind = asStr(r.relkind);
    if (kind === "r" || kind === "p") {
      const ps = asStrArr(r.parent_schemas);
      const pt = asStrArr(r.parent_tables);
      tables.set(key(schema, name), {
        schema,
        name,
        kind: kind === "p" ? "partitioned_table" : "table",
        inheritance: {
          isPartition: asBool(r.is_partition),
          hasInheritanceChildren: asBool(r.has_inheritance_children),
          inheritsFrom: ps.map((s, i) => ({ schema: s, table: pt[i] ?? "" }))
        },
        columns: [],
        uniqueKeys: [],
        foreignKeys: []
      });
    } else {
      others.push({ schema, name, kind: kind === "v" ? "view" : kind === "m" ? "materialized_view" : "foreign_table" });
    }
  }
  const cols2 = [...colRows].sort((a, b) => Number(a.attnum) - Number(b.attnum));
  for (const c of cols2) {
    const t = tables.get(key(asStr(c.schema_name), asStr(c.rel_name)));
    if (!t) continue;
    const col = { name: asStr(c.column_name), nullable: !asBool(c.not_null) };
    if (asBool(c.not_null_unvalidated)) col.notNullUnvalidated = true;
    if (asBool(c.is_domain) && !asBool(c.not_null)) col.domainType = true;
    t.columns.push(col);
  }
  const idxByOid = /* @__PURE__ */ new Map();
  for (const i of idxRows) idxByOid.set(asStr(i.index_oid), i);
  const constraintIndexOids = /* @__PURE__ */ new Set();
  for (const c of conRows) {
    const t = tables.get(key(asStr(c.schema_name), asStr(c.rel_name)));
    if (!t) continue;
    const contype = asStr(c.contype);
    const name = asStr(c.con_name);
    const columns = asStrArr(c.columns);
    const hasExprPart = columns.length === 0 || columns.some((x) => x === "");
    if (contype === "p" || contype === "u") {
      const idxOid = asStr(c.index_oid);
      constraintIndexOids.add(idxOid);
      const idx = idxByOid.get(idxOid);
      const idxCols = idx ? asStrArr(idx.columns) : [];
      const nkey = idx ? Number(idx.indnkeyatts) : columns.length;
      const k = {
        kind: contype === "p" ? "primary_key" : "unique_constraint",
        name,
        columns: hasExprPart || !idx ? null : columns,
        includeColumns: idx ? idxCols.slice(nkey).filter((x) => x !== "") : [],
        partial: idx ? asBool(idx.is_partial) : false,
        expression: hasExprPart,
        valid: idx ? asBool(idx.indisvalid) && asBool(idx.indisready) && asBool(idx.indislive) : false,
        deferrable: asBool(c.condeferrable),
        immediate: idx ? asBool(idx.indimmediate) : !asBool(c.condeferrable),
        nullsNotDistinct: idx ? asBool(idx.nulls_not_distinct) : false,
        period: asBool(c.conperiod)
      };
      if (!idx) gaps.push({ scope: t.schema, reason: `backing index of constraint ${name} on ${t.schema}.${t.name} was not returned` });
      t.uniqueKeys.push(k);
    } else if (contype === "x") {
      t.uniqueKeys.push({
        kind: "exclusion_constraint",
        name,
        columns: hasExprPart ? null : columns,
        includeColumns: [],
        partial: false,
        expression: hasExprPart,
        valid: true,
        deferrable: asBool(c.condeferrable),
        immediate: !asBool(c.condeferrable),
        nullsNotDistinct: false,
        period: asBool(c.conperiod)
      });
    } else if (contype === "f") {
      const refCols = asStrArr(c.ref_columns);
      if (hasExprPart || refCols.length !== columns.length || refCols.some((x) => x === "") || c.ref_schema == null || c.ref_table == null) {
        gaps.push({ scope: t.schema, reason: `foreign key ${name} on ${t.schema}.${t.name} has a catalog shape v0.1 does not understand` });
        continue;
      }
      const fk = {
        name,
        columns,
        references: { schema: asStr(c.ref_schema), table: asStr(c.ref_table), columns: refCols },
        deferrable: asBool(c.condeferrable),
        validated: asBool(c.convalidated),
        enforced: c.conenforced === void 0 ? true : asBool(c.conenforced)
      };
      if (asBool(c.conperiod)) fk.period = true;
      t.foreignKeys.push(fk);
    }
  }
  for (const i of idxRows) {
    if (constraintIndexOids.has(asStr(i.index_oid))) continue;
    const t = tables.get(key(asStr(i.schema_name), asStr(i.rel_name)));
    if (!t) continue;
    const all = asStrArr(i.columns);
    const nkey = Number(i.indnkeyatts);
    const keyCols = all.slice(0, nkey);
    const expr = asBool(i.has_expressions) || keyCols.some((x) => x === "");
    t.uniqueKeys.push({
      kind: "unique_index",
      name: asStr(i.index_name),
      columns: expr ? null : keyCols,
      includeColumns: all.slice(nkey).filter((x) => x !== ""),
      partial: asBool(i.is_partial),
      expression: expr,
      valid: asBool(i.indisvalid) && asBool(i.indisready) && asBool(i.indislive),
      deferrable: !asBool(i.indimmediate),
      immediate: asBool(i.indimmediate),
      nullsNotDistinct: asBool(i.nulls_not_distinct),
      period: false
    });
  }
  const sortedTables = [...tables.values()].map((t) => ({
    ...t,
    uniqueKeys: t.uniqueKeys.sort((a, b) => compareStrings(a.name, b.name)),
    foreignKeys: t.foreignKeys.sort((a, b) => compareStrings(a.name, b.name))
  })).sort((a, b) => compareStrings(`${a.schema}\0${a.name}`, `${b.schema}\0${b.name}`));
  others.sort((a, b) => compareStrings(`${a.schema}\0${a.name}`, `${b.schema}\0${b.name}`));
  return { tables: sortedTables, others, gaps };
}

// src/postgres/live.ts
function workerEnv(source = process.env) {
  const allow = ["SystemRoot", "SYSTEMROOT", "windir", "WINDIR", "NODE_EXTRA_CA_CERTS", "TZ"];
  const env = {};
  for (const k of allow) {
    const v = source[k];
    if (typeof v === "string") env[k] = v;
  }
  return env;
}
async function collectLiveViaWorker(opts, scriptPath = process.argv[1] ?? "") {
  const raw = process.env[opts.envName];
  if (raw === void 0 || raw === "") {
    throw new DbpError("DATABASE_URL_ENV_MISSING", `environment variable ${opts.envName} is not set; see README for PowerShell and Bash examples`);
  }
  parseDatabaseUrl(raw, opts.envName);
  const secrets = targetSecrets(raw, null);
  const request = { url: raw, envName: opts.envName, schemas: opts.schemas, timeoutMs: opts.timeoutMs };
  return await new Promise((resolve4, reject) => {
    const child = (0, import_node_child_process.spawn)(process.execPath, [scriptPath, "__live-worker"], {
      env: workerEnv(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    let out = "";
    let err = "";
    const killTimer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new DbpError("LIVE_TIMEOUT", `live metadata collection exceeded ${opts.timeoutMs} ms and was aborted`));
    }, opts.timeoutMs + 5e3);
    child.stdout.setEncoding("utf8").on("data", (d) => {
      if (out.length < 256 * 1024 * 1024) out += d;
    });
    child.stderr.setEncoding("utf8").on("data", (d) => {
      if (err.length < 64 * 1024) err += d;
    });
    child.on("error", (e) => {
      clearTimeout(killTimer);
      reject(new DbpError("WORKER_SPAWN_FAILED", `could not start the live worker: ${formatError(e, secrets)}`));
    });
    child.on("close", () => {
      clearTimeout(killTimer);
      const line = out.trim().split("\n").pop() ?? "";
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        reject(new DbpError("WORKER_FAILED", `live worker failed without a result${err ? `: ${redact(err.slice(0, 500), secrets)}` : ""}`));
        return;
      }
      if (msg.ok) resolve4(msg.result);
      else reject(new DbpError(msg.code, redact(msg.message, secrets)));
    });
    child.stdin.end(JSON.stringify(request));
  });
}
async function runLiveWorker() {
  for (const k of Object.keys(process.env)) {
    if (/^PG/i.test(k) || k === "DATABASE_URL") delete process.env[k];
  }
  const input = await readStdin();
  let req;
  try {
    req = JSON.parse(input);
  } catch {
    process.stdout.write(`${JSON.stringify({ ok: false, code: "WORKER_BAD_INPUT", message: "worker input was not JSON" })}
`);
    return 2;
  }
  let target = null;
  try {
    target = parseDatabaseUrl(req.url, req.envName);
    const result = await collectWithPg(target, req.schemas, req.timeoutMs);
    process.stdout.write(`${JSON.stringify({ ok: true, result: { ...result, warnings: target.warnings } })}
`);
    return 0;
  } catch (e) {
    const secrets = targetSecrets(req.url, target);
    const code = e instanceof DbpError ? e.code : "LIVE_COLLECTION_FAILED";
    const message = e instanceof DbpError ? redact(e.message, secrets) : `live metadata collection failed: ${formatError(e, secrets)}`;
    process.stdout.write(`${JSON.stringify({ ok: false, code, message })}
`);
    return 2;
  }
}
async function collectWithPg(t, schemas, timeoutMs) {
  const pg2 = await Promise.resolve().then(() => (init_esm(), esm_exports));
  const Client2 = (pg2.default ?? pg2).Client;
  let ssl = false;
  if (t.sslMode !== "disable") {
    ssl = { rejectUnauthorized: true };
    if (t.sslRootCertPath && t.sslRootCertPath !== "system") {
      try {
        ssl.ca = (0, import_node_fs2.readFileSync)(t.sslRootCertPath, "utf8");
      } catch {
        throw new DbpError("SSL_ROOT_CERT_UNREADABLE", "sslrootcert file could not be read");
      }
    }
    if (t.sslMode === "verify-ca") ssl.checkServerIdentity = () => void 0;
  }
  const password = t.password ?? "";
  const statementTimeout = Math.max(1e3, Math.min(timeoutMs, 6e4));
  const client = new Client2({
    host: t.host,
    port: t.port,
    database: t.database,
    user: t.user,
    // A function prevents pg from consulting PGPASSWORD / pgpass for an absent password.
    password: async () => password,
    ssl,
    sslnegotiation: "postgres",
    client_encoding: "UTF8",
    options: "-c default_transaction_read_only=on",
    binary: false,
    application_name: "db-preflight",
    connectionTimeoutMillis: Math.min(timeoutMs, 15e3),
    statement_timeout: statementTimeout,
    query_timeout: statementTimeout + 2e3,
    idle_in_transaction_session_timeout: statementTimeout + 5e3,
    keepAlive: false
  });
  if (client.replication) throw new DbpError("UNEXPECTED_REPLICATION", "replication mode must not be enabled");
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    void client.end().catch(() => void 0);
  }, timeoutMs);
  try {
    await client.connect();
    const result = await collectCatalog(client, schemas);
    if (timedOut) throw new DbpError("LIVE_TIMEOUT", `live metadata collection exceeded ${timeoutMs} ms and was aborted`);
    return result;
  } catch (e) {
    if (timedOut) throw new DbpError("LIVE_TIMEOUT", `live metadata collection exceeded ${timeoutMs} ms and was aborted`);
    throw e;
  } finally {
    clearTimeout(deadline);
    await client.end().catch(() => void 0);
  }
}
async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

// src/postgres/snapshot.ts
var import_node_fs3 = require("node:fs");
var SNAPSHOT_LIMITS = {
  maxBytes: 64 * 1024 * 1024,
  maxIdentifierLength: 512,
  maxTables: 1e5,
  maxColumnsPerTable: 5e3,
  maxKeysPerTable: 5e3
};
var SnapshotInvalid = class extends DbpError {
  constructor(path, message) {
    super("SNAPSHOT_INVALID", `invalid snapshot at ${path}: ${message}`);
  }
};
function obj(v, path) {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new SnapshotInvalid(path, "expected an object");
  return v;
}
function arr(v, path, max) {
  if (!Array.isArray(v)) throw new SnapshotInvalid(path, "expected an array");
  if (v.length > max) throw new SnapshotInvalid(path, `more than ${max} entries`);
  return v;
}
function str(v, path, max = SNAPSHOT_LIMITS.maxIdentifierLength) {
  if (typeof v !== "string") throw new SnapshotInvalid(path, "expected a string");
  if (v.length === 0 || v.length > max) throw new SnapshotInvalid(path, `string length must be 1..${max}`);
  return v;
}
function bool(v, path) {
  if (typeof v !== "boolean") throw new SnapshotInvalid(path, "expected a boolean");
  return v;
}
function strList(v, path, max) {
  return arr(v, path, max).map((x, i) => str(x, `${path}[${i}]`));
}
function oneOf(v, path, allowed) {
  if (typeof v !== "string" || !allowed.includes(v)) {
    throw new SnapshotInvalid(path, `expected one of ${allowed.join(", ")}`);
  }
  return v;
}
var UNIQUE_KINDS = ["primary_key", "unique_constraint", "unique_index", "exclusion_constraint"];
function readUniqueKey(v, p) {
  const o = obj(v, p);
  const columns = o.columns === null ? null : strList(o.columns, `${p}.columns`, 1e3);
  return {
    kind: oneOf(o.kind, `${p}.kind`, UNIQUE_KINDS),
    name: str(o.name, `${p}.name`),
    columns,
    includeColumns: strList(o.includeColumns ?? [], `${p}.includeColumns`, 1e3),
    partial: bool(o.partial, `${p}.partial`),
    expression: bool(o.expression, `${p}.expression`),
    valid: bool(o.valid, `${p}.valid`),
    deferrable: bool(o.deferrable, `${p}.deferrable`),
    immediate: bool(o.immediate, `${p}.immediate`),
    nullsNotDistinct: bool(o.nullsNotDistinct ?? false, `${p}.nullsNotDistinct`),
    period: bool(o.period ?? false, `${p}.period`)
  };
}
function readForeignKey(v, p) {
  const o = obj(v, p);
  const ref = obj(o.references, `${p}.references`);
  const fk = {
    name: str(o.name, `${p}.name`),
    columns: strList(o.columns, `${p}.columns`, 1e3),
    references: {
      schema: str(ref.schema, `${p}.references.schema`),
      table: str(ref.table, `${p}.references.table`),
      columns: strList(ref.columns, `${p}.references.columns`, 1e3)
    },
    deferrable: bool(o.deferrable, `${p}.deferrable`),
    validated: bool(o.validated, `${p}.validated`),
    enforced: bool(o.enforced ?? true, `${p}.enforced`)
  };
  if (o.period !== void 0) fk.period = bool(o.period, `${p}.period`);
  if (new Set(fk.columns).size !== fk.columns.length || new Set(fk.references.columns).size !== fk.references.columns.length) {
    throw new SnapshotInvalid(p, "foreign key column lists must not repeat a column");
  }
  if (fk.columns.length === 0 || fk.columns.length !== fk.references.columns.length) {
    throw new SnapshotInvalid(p, "foreign key columns and referenced columns must be non-empty and equally long");
  }
  return fk;
}
function readInheritance(v, p) {
  const o = obj(v, p);
  return {
    isPartition: bool(o.isPartition, `${p}.isPartition`),
    hasInheritanceChildren: bool(o.hasInheritanceChildren, `${p}.hasInheritanceChildren`),
    inheritsFrom: arr(o.inheritsFrom, `${p}.inheritsFrom`, 1e3).map((x, i) => {
      const r = obj(x, `${p}.inheritsFrom[${i}]`);
      return { schema: str(r.schema, `${p}.inheritsFrom[${i}].schema`), table: str(r.table, `${p}.inheritsFrom[${i}].table`) };
    })
  };
}
function readTable(v, p, requested) {
  const o = obj(v, p);
  const schema = str(o.schema, `${p}.schema`);
  if (!requested.has(schema)) throw new SnapshotInvalid(`${p}.schema`, "table belongs to a schema outside requestedSchemas");
  const columns = arr(o.columns, `${p}.columns`, SNAPSHOT_LIMITS.maxColumnsPerTable).map((c, i) => {
    const co = obj(c, `${p}.columns[${i}]`);
    const col = { name: str(co.name, `${p}.columns[${i}].name`), nullable: bool(co.nullable, `${p}.columns[${i}].nullable`) };
    if (co.domainType !== void 0) col.domainType = bool(co.domainType, `${p}.columns[${i}].domainType`);
    if (co.notNullUnvalidated !== void 0) col.notNullUnvalidated = bool(co.notNullUnvalidated, `${p}.columns[${i}].notNullUnvalidated`);
    return col;
  });
  const seen = /* @__PURE__ */ new Set();
  for (const c of columns) {
    if (seen.has(c.name)) throw new SnapshotInvalid(`${p}.columns`, "duplicate column name");
    seen.add(c.name);
  }
  return {
    schema,
    name: str(o.name, `${p}.name`),
    kind: oneOf(o.kind, `${p}.kind`, ["table", "partitioned_table"]),
    inheritance: readInheritance(o.inheritance, `${p}.inheritance`),
    columns,
    uniqueKeys: arr(o.uniqueKeys, `${p}.uniqueKeys`, SNAPSHOT_LIMITS.maxKeysPerTable).map((k, i) => readUniqueKey(k, `${p}.uniqueKeys[${i}]`)),
    foreignKeys: arr(o.foreignKeys, `${p}.foreignKeys`, SNAPSHOT_LIMITS.maxKeysPerTable).map((k, i) => readForeignKey(k, `${p}.foreignKeys[${i}]`))
  };
}
function parseSnapshot(raw) {
  const o = obj(raw, "$");
  if (o.snapshotVersion !== SNAPSHOT_VERSION) {
    throw new DbpError("SNAPSHOT_UNSUPPORTED_VERSION", `unsupported snapshotVersion (expected ${SNAPSHOT_VERSION}); this tool does not guess other versions`);
  }
  const gen = obj(o.generator, "$.generator");
  if (gen.name !== "db-preflight") throw new SnapshotInvalid("$.generator.name", 'expected "db-preflight"');
  const collectedAt = str(o.collectedAt, "$.collectedAt", 64);
  if (Number.isNaN(Date.parse(collectedAt))) throw new SnapshotInvalid("$.collectedAt", "expected an ISO 8601 timestamp");
  const server = obj(o.server, "$.server");
  const versionNum = server.versionNum;
  if (versionNum !== null && (typeof versionNum !== "number" || !Number.isInteger(versionNum) || versionNum < 0)) {
    throw new SnapshotInvalid("$.server.versionNum", "expected an integer or null");
  }
  const requestedSchemas = strList(o.requestedSchemas, "$.requestedSchemas", 1e3);
  if (requestedSchemas.length === 0) throw new SnapshotInvalid("$.requestedSchemas", "must not be empty");
  const requested = new Set(requestedSchemas);
  const schemasFound = strList(o.schemasFound, "$.schemasFound", 1e3);
  for (const s of schemasFound) if (!requested.has(s)) throw new SnapshotInvalid("$.schemasFound", "contains a schema that was not requested");
  const tables = arr(o.tables, "$.tables", SNAPSHOT_LIMITS.maxTables).map((t, i) => readTable(t, `$.tables[${i}]`, requested));
  const keys = /* @__PURE__ */ new Set();
  for (const t of tables) {
    const k = JSON.stringify([t.schema, t.name]);
    if (keys.has(k)) throw new SnapshotInvalid("$.tables", "duplicate schema/table entry");
    keys.add(k);
  }
  const otherRelations = arr(o.otherRelations ?? [], "$.otherRelations", SNAPSHOT_LIMITS.maxTables).map((r, i) => {
    const ro2 = obj(r, `$.otherRelations[${i}]`);
    const schema = str(ro2.schema, `$.otherRelations[${i}].schema`);
    if (!requested.has(schema)) throw new SnapshotInvalid(`$.otherRelations[${i}].schema`, "outside requestedSchemas");
    return {
      schema,
      name: str(ro2.name, `$.otherRelations[${i}].name`),
      kind: oneOf(ro2.kind, `$.otherRelations[${i}].kind`, ["view", "materialized_view", "foreign_table"])
    };
  });
  const gaps = arr(o.gaps ?? [], "$.gaps", 1e4).map((g, i) => {
    const go = obj(g, `$.gaps[${i}]`);
    return { scope: str(go.scope, `$.gaps[${i}].scope`), reason: str(go.reason, `$.gaps[${i}].reason`, 2e3) };
  });
  if (o.complete === true && gaps.length > 0) {
    throw new SnapshotInvalid("$.complete", "complete is true but gaps are recorded");
  }
  const ro = obj(o.readOnly ?? { verified: false, detail: "not recorded" }, "$.readOnly");
  return {
    snapshotVersion: 1,
    generator: { name: "db-preflight", version: str(gen.version, "$.generator.version", 64) },
    origin: oneOf(o.origin, "$.origin", ["live", "synthetic"]),
    collectedAt,
    server: {
      version: server.version === null ? null : str(server.version, "$.server.version", 128),
      versionNum
    },
    requestedSchemas,
    schemasFound,
    complete: bool(o.complete, "$.complete"),
    gaps,
    readOnly: { verified: bool(ro.verified, "$.readOnly.verified"), detail: str(ro.detail, "$.readOnly.detail", 2e3) },
    tables,
    otherRelations
  };
}
function loadSnapshotFile(path) {
  let size;
  try {
    size = (0, import_node_fs3.statSync)(path).size;
  } catch {
    throw new DbpError("SNAPSHOT_NOT_FOUND", "--snapshot file does not exist or is not readable");
  }
  if (size > SNAPSHOT_LIMITS.maxBytes) throw new DbpError("SNAPSHOT_TOO_LARGE", `--snapshot exceeds ${SNAPSHOT_LIMITS.maxBytes} bytes`);
  let parsed;
  try {
    parsed = JSON.parse((0, import_node_fs3.readFileSync)(path, "utf8"));
  } catch {
    throw new DbpError("SNAPSHOT_NOT_JSON", "--snapshot is not valid JSON");
  }
  return parseSnapshot(parsed);
}
function snapshotToDatabaseModel(s, origin) {
  return {
    origin,
    snapshotOrigin: s.origin,
    collectedAt: s.collectedAt,
    server: s.server,
    requestedSchemas: s.requestedSchemas,
    schemasFound: s.schemasFound,
    complete: s.complete,
    gaps: s.gaps,
    tables: s.tables,
    otherRelations: s.otherRelations,
    readOnly: s.readOnly
  };
}
function restrictScope(db, schemas) {
  const missing = schemas.filter((s) => !db.requestedSchemas.includes(s));
  if (missing.length > 0) {
    throw new DbpError("SCOPE_NOT_IN_SNAPSHOT", `--schemas includes schemas that the snapshot did not collect: ${missing.join(", ")}`);
  }
  const keep = new Set(schemas);
  const keptGaps = db.gaps.filter((g) => g.scope === "*" || keep.has(g.scope));
  const complete = db.complete || db.gaps.length > 0 && keptGaps.length === 0;
  return {
    ...db,
    complete,
    requestedSchemas: [...schemas].sort(compareStrings),
    schemasFound: db.schemasFound.filter((s) => keep.has(s)),
    gaps: keptGaps,
    tables: db.tables.filter((t) => keep.has(t.schema)),
    otherRelations: db.otherRelations.filter((r) => keep.has(r.schema))
  };
}
function databaseModelToSnapshot(db) {
  const sortTables = [...db.tables].sort((a, b) => compareStrings(`${a.schema}\0${a.name}`, `${b.schema}\0${b.name}`));
  return {
    snapshotVersion: 1,
    generator: { name: "db-preflight", version: TOOL_VERSION },
    origin: db.origin === "live" ? "live" : db.snapshotOrigin ?? "synthetic",
    collectedAt: db.collectedAt,
    server: db.server,
    requestedSchemas: [...db.requestedSchemas].sort(compareStrings),
    schemasFound: [...db.schemasFound].sort(compareStrings),
    complete: db.complete,
    gaps: db.gaps,
    readOnly: db.readOnly,
    tables: sortTables.map((t) => ({
      ...t,
      uniqueKeys: [...t.uniqueKeys].sort((a, b) => compareStrings(a.name, b.name)),
      foreignKeys: [...t.foreignKeys].sort((a, b) => compareStrings(a.name, b.name))
    })),
    otherRelations: [...db.otherRelations].sort((a, b) => compareStrings(`${a.schema}\0${a.name}`, `${b.schema}\0${b.name}`))
  };
}

// src/prisma/index.ts
var import_node_crypto3 = require("node:crypto");
var import_node_fs4 = require("node:fs");

// src/prisma/model.ts
var PRISMA_SCALARS = /* @__PURE__ */ new Set(["String", "Boolean", "Int", "BigInt", "Float", "Decimal", "DateTime", "Json", "Bytes"]);
var NEUTRAL_FIELD_ATTRIBUTES = /* @__PURE__ */ new Set(["default", "updatedAt", "ignore"]);
var NEUTRAL_BLOCK_ATTRIBUTES = /* @__PURE__ */ new Set(["index"]);
var ID_UNIQUE_FIELD_ARGS = /* @__PURE__ */ new Set(["map", "length", "sort", "clustered"]);
var ID_UNIQUE_BLOCK_ARGS = /* @__PURE__ */ new Set(["fields", "name", "map", "length", "sort", "clustered"]);
var RELATION_ARGS = /* @__PURE__ */ new Set(["name", "fields", "references", "map", "onDelete", "onUpdate"]);
function buildPrismaModel(asts, files, skipped) {
  const diagnostics = [];
  const blocks = [];
  for (const ast of asts) {
    diagnostics.push(...ast.diagnostics);
    blocks.push(...ast.blocks);
  }
  for (const s of skipped) {
    if (s.reason === "excluded directory") continue;
    diagnostics.push({
      code: "SCHEMA_INPUT_NOT_READ",
      severity: "blocking",
      message: `input "${s.path}" was not read (${s.reason}); models it may contain were not analyzed`
    });
  }
  const typeNames = /* @__PURE__ */ new Map();
  const duplicateNames = /* @__PURE__ */ new Set();
  for (const b of blocks) {
    if (!["model", "view", "enum", "type"].includes(b.keyword)) continue;
    if (typeNames.has(b.name)) {
      duplicateNames.add(b.name);
      diagnostics.push({
        code: "PRISMA_DUPLICATE_NAME",
        severity: "blocking",
        message: `"${b.name}" is declared more than once`,
        span: b.span,
        model: b.name
      });
    } else {
      typeNames.set(b.name, b);
    }
  }
  const modelNames = new Set(blocks.filter((b) => b.keyword === "model").map((b) => b.name));
  const viewNames = new Set(blocks.filter((b) => b.keyword === "view").map((b) => b.name));
  const enumNames = new Set(blocks.filter((b) => b.keyword === "enum").map((b) => b.name));
  const compositeNames = new Set(blocks.filter((b) => b.keyword === "type").map((b) => b.name));
  const datasources = blocks.filter((b) => b.keyword === "datasource");
  let datasource;
  if (datasources.length > 1) {
    diagnostics.push({
      code: "PRISMA_MULTIPLE_DATASOURCES",
      severity: "blocking",
      message: "more than one datasource block found; relationMode and schemas cannot be determined",
      span: datasources[1].span
    });
  } else if (datasources.length === 1) {
    datasource = readDatasource(datasources[0], diagnostics);
  } else {
    diagnostics.push({
      code: "PRISMA_NO_DATASOURCE",
      severity: "warning",
      message: "no datasource block found in the scanned files; relationMode is unknown"
    });
  }
  for (const b of blocks) {
    if (b.keyword === "type") {
      diagnostics.push({
        code: "PRISMA_UNSUPPORTED_COMPOSITE_TYPE",
        severity: "blocking",
        message: `composite type "${b.name}" is not supported (MongoDB-only feature)`,
        span: b.span
      });
    }
    if (b.keyword === "datasource" || b.keyword === "generator" || b.keyword === "type" || !b.known) {
      diagnostics.push(...b.diagnostics);
    }
  }
  const models = [];
  for (const b of blocks) {
    if (b.keyword !== "model" && b.keyword !== "view") continue;
    const model = readModel(b, { modelNames, viewNames, enumNames, compositeNames }, diagnostics);
    if (duplicateNames.has(b.name)) {
      model.issues.push({ code: "PRISMA_DUPLICATE_NAME", severity: "blocking", message: `"${b.name}" is declared more than once`, model: b.name });
    }
    if (datasource?.schemas && !model.schema) {
      diagnostics.push({
        code: "PRISMA_MISSING_SCHEMA_ATTRIBUTE",
        severity: "warning",
        message: `datasource declares schemas but ${b.keyword} "${b.name}" has no @@schema`,
        span: model.span,
        model: model.name
      });
    }
    if (datasource?.schemas && model.schema && !datasource.schemas.includes(model.schema)) {
      diagnostics.push({
        code: "PRISMA_SCHEMA_NOT_DECLARED",
        severity: "warning",
        message: `@@schema("${model.schema}") on "${b.name}" is not listed in datasource schemas`,
        span: model.span,
        model: model.name
      });
    }
    models.push(model);
  }
  models.sort((a, b) => compareStrings(a.name, b.name));
  const enums = blocks.filter((b) => b.keyword === "enum").map((b) => {
    const schemaAttr = b.blockAttributes.find((a) => a.name === "schema");
    const schema = schemaAttr ? firstString(schemaAttr.args) : void 0;
    for (const d of b.diagnostics) diagnostics.push(d);
    return schema ? { name: b.name, schema, span: b.span } : { name: b.name, span: b.span };
  }).sort((a, b) => compareStrings(a.name, b.name));
  const reported = new Set(diagnostics);
  for (const m of models) {
    for (const d of [...m.issues, ...m.fields.flatMap((f) => f.issues)]) {
      if (!reported.has(d)) {
        diagnostics.push(d);
        reported.add(d);
      }
    }
  }
  const relations = resolveRelations(models);
  return { files, skipped, ...datasource ? { datasource } : {}, models, enums, relations, diagnostics };
}
function readDatasource(b, diagnostics) {
  const info = { relationModeSource: "default", relationMode: "foreignKeys", span: b.span };
  for (const p of b.properties) {
    if (p.key === "provider") {
      if (p.value.kind === "string") info.provider = p.value.value;
      else
        diagnostics.push({ code: "PRISMA_PROVIDER_NOT_LITERAL", severity: "blocking", message: "datasource provider is not a string literal", span: p.span });
    } else if (p.key === "relationMode") {
      if (p.value.kind === "string" && (p.value.value === "prisma" || p.value.value === "foreignKeys")) {
        info.relationMode = p.value.value;
        info.relationModeSource = "explicit";
      } else {
        delete info.relationMode;
        info.relationModeSource = "unknown";
        diagnostics.push({
          code: "PRISMA_RELATION_MODE_UNKNOWN",
          severity: "warning",
          message: 'relationMode is not "foreignKeys" or "prisma"; foreign-key checks are unknown',
          span: p.span
        });
      }
    } else if (p.key === "schemas") {
      if (p.value.kind === "array" && p.value.items.every((i) => i.kind === "string")) {
        info.schemas = p.value.items.map((i) => i.value);
      } else {
        diagnostics.push({
          code: "PRISMA_SCHEMAS_NOT_LITERAL",
          severity: "blocking",
          message: "datasource schemas is not a list of string literals",
          span: p.span
        });
      }
    }
  }
  return info;
}
function readModel(b, names, diagnostics) {
  const model = {
    name: b.name,
    blockKind: b.keyword === "view" ? "view" : "model",
    dbName: b.name,
    fields: [],
    uniques: [],
    ignored: false,
    issues: [],
    span: b.span
  };
  for (const d of b.diagnostics) {
    diagnostics.push(d);
    if (d.severity === "blocking") model.issues.push(d);
  }
  for (const f of b.fields) model.fields.push(readField(b.name, f, names, model));
  const fieldNames = new Set(model.fields.map((f) => f.name));
  for (const f of model.fields) {
    if (f.isId || f.isUnique) {
      const attr = f.isId ? "id" : "unique";
      const node = b.fields.find((n) => n.name === f.name)?.attributes.find((a) => a.name === attr);
      const bad = node?.args?.find((a) => a.name !== void 0 && !ID_UNIQUE_FIELD_ARGS.has(a.name));
      model.uniques.push({
        kind: f.isId ? "id" : "unique",
        fields: [f.name],
        origin: "field",
        supported: !bad,
        ...bad ? { unsupportedReason: `argument "${bad.name}" on @${attr} is not evaluated by v0.1` } : {},
        span: node?.span ?? f.span
      });
    }
  }
  for (const a of b.blockAttributes) {
    switch (a.name) {
      case "map": {
        const v = firstString(a.args) ?? namedString(a.args, "name");
        if (v === void 0) model.issues.push(issue("PRISMA_BAD_MAP", "@@map needs a string argument", a, b.name));
        else model.dbName = v;
        break;
      }
      case "schema": {
        const v = firstString(a.args);
        if (v === void 0) model.issues.push(issue("PRISMA_BAD_SCHEMA", "@@schema needs a string argument", a, b.name));
        else model.schema = v;
        break;
      }
      case "ignore":
        model.ignored = true;
        break;
      case "id":
      case "unique": {
        model.uniques.push(readBlockUnique(a, fieldNames));
        break;
      }
      default:
        if (NEUTRAL_BLOCK_ATTRIBUTES.has(a.name)) break;
        model.issues.push(issue("PRISMA_UNSUPPORTED_ATTRIBUTE", `block attribute @@${a.name} is not supported by v0.1`, a, b.name));
    }
  }
  return model;
}
function readBlockUnique(a, fieldNames) {
  const kind = a.name === "id" ? "id" : "unique";
  const listExpr = a.args?.find((x) => x.name === void 0)?.value ?? a.args?.find((x) => x.name === "fields")?.value;
  const decl = { kind, fields: [], origin: "block", supported: true, span: a.span };
  if (listExpr?.kind !== "array") {
    decl.supported = false;
    decl.unsupportedReason = `@@${a.name} has no field list`;
    return decl;
  }
  for (const item of listExpr.items) {
    const name = fieldRefName(item);
    if (name === void 0) {
      decl.supported = false;
      decl.unsupportedReason = `@@${a.name} contains an entry that is not a field reference`;
    } else {
      decl.fields.push(name);
      if (!fieldNames.has(name)) {
        decl.supported = false;
        decl.unsupportedReason = `@@${a.name} references unknown field "${name}"`;
      }
    }
  }
  const bad = a.args?.find((x) => x.name !== void 0 && !ID_UNIQUE_BLOCK_ARGS.has(x.name));
  if (bad) {
    decl.supported = false;
    decl.unsupportedReason = bad.name === "where" ? `partial @@${a.name}(where: ...) is not evaluated by v0.1` : `argument "${bad.name}" on @@${a.name} is not evaluated by v0.1`;
  }
  if (a.args && a.args.filter((x) => x.name === void 0).length > 1) {
    decl.supported = false;
    decl.unsupportedReason = `@@${a.name} has unexpected positional arguments`;
  }
  return decl;
}
function readField(modelName, f, names, model) {
  const field = {
    name: f.name,
    dbName: f.name,
    typeName: f.typeName,
    kind: classifyType(f, names),
    isList: f.isList,
    isOptional: f.isOptional,
    isId: false,
    isUnique: false,
    ignored: false,
    issues: [],
    span: f.span
  };
  if (field.kind === "unknown_type") {
    const what = names.compositeNames.has(f.typeName) ? "composite type" : names.viewNames.has(f.typeName) ? "view" : "unknown type";
    field.issues.push({
      code: "PRISMA_UNKNOWN_FIELD_TYPE",
      severity: "blocking",
      message: `field "${f.name}" uses ${what} "${f.typeName}", which v0.1 cannot evaluate`,
      span: f.span,
      model: modelName,
      field: f.name
    });
  }
  for (const a of f.attributes) {
    switch (a.name) {
      case "id":
        field.isId = true;
        break;
      case "unique":
        field.isUnique = true;
        break;
      case "map": {
        const v = firstString(a.args) ?? namedString(a.args, "name");
        if (v === void 0) field.issues.push(issue("PRISMA_BAD_MAP", "@map needs a string argument", a, modelName, f.name));
        else field.dbName = v;
        break;
      }
      case "relation":
        field.relation = readRelation(a, modelName, f.name, field);
        break;
      default:
        if (a.name === "ignore") field.ignored = true;
        if (NEUTRAL_FIELD_ATTRIBUTES.has(a.name) || a.name.startsWith("db.")) break;
        field.issues.push(issue("PRISMA_UNSUPPORTED_ATTRIBUTE", `field attribute @${a.name} is not supported by v0.1`, a, modelName, f.name));
    }
  }
  if (field.relation && field.kind !== "relation") {
    field.issues.push({
      code: "PRISMA_RELATION_ON_NON_RELATION",
      severity: "blocking",
      message: `@relation on "${f.name}", whose type is not a model`,
      span: f.span,
      model: modelName,
      field: f.name
    });
  }
  void model;
  return field;
}
function classifyType(f, names) {
  if (f.typeName === "Unsupported" && f.typeArgs) return "unsupported_type";
  if (PRISMA_SCALARS.has(f.typeName)) return "scalar";
  if (names.enumNames.has(f.typeName)) return "enum";
  if (names.modelNames.has(f.typeName)) return "relation";
  return "unknown_type";
}
function readRelation(a, modelName, fieldName, field) {
  const rel = { span: a.span };
  const args = a.args ?? [];
  const positional = args.filter((x) => x.name === void 0);
  if (positional.length > 1) field.issues.push(issue("PRISMA_BAD_RELATION", "@relation has more than one positional argument", a, modelName, fieldName));
  const nameExpr = positional[0]?.value ?? args.find((x) => x.name === "name")?.value;
  if (nameExpr) {
    if (nameExpr.kind === "string") rel.name = nameExpr.value;
    else field.issues.push(issue("PRISMA_BAD_RELATION", "@relation name must be a string", a, modelName, fieldName));
  }
  for (const key2 of ["fields", "references"]) {
    const e = args.find((x) => x.name === key2)?.value;
    if (!e) continue;
    const list = e.kind === "array" ? e.items.map(fieldRefName) : [void 0];
    if (list.some((n) => n === void 0)) {
      field.issues.push(issue("PRISMA_BAD_RELATION", `@relation ${key2} must be a list of field names`, a, modelName, fieldName));
    } else {
      rel[key2] = list;
    }
  }
  const bad = args.find((x) => x.name !== void 0 && !RELATION_ARGS.has(x.name));
  if (bad) field.issues.push(issue("PRISMA_UNSUPPORTED_ATTRIBUTE", `@relation argument "${bad.name}" is not supported by v0.1`, a, modelName, fieldName));
  return rel;
}
function fieldRefName(e) {
  if (e.kind === "ident" && !e.name.includes(".")) return e.name;
  if (e.kind === "call" && !e.name.includes(".") && e.args.every((x) => x.name === "sort" || x.name === "length" || x.name === "ops")) return e.name;
  return void 0;
}
function firstString(args) {
  const a = args?.find((x) => x.name === void 0);
  return a && a.value.kind === "string" ? a.value.value : void 0;
}
function namedString(args, name) {
  const a = args?.find((x) => x.name === name);
  return a && a.value.kind === "string" ? a.value.value : void 0;
}
function issue(code, message, a, model, field) {
  return { code, severity: "blocking", message, span: a.span, model, ...field ? { field } : {} };
}
function resolveRelations(models) {
  const groups = /* @__PURE__ */ new Map();
  const fieldOf = /* @__PURE__ */ new Map();
  const targetOf = /* @__PURE__ */ new Map();
  for (const m of models) {
    if (m.blockKind !== "model") continue;
    for (const f of m.fields) {
      if (f.kind !== "relation") continue;
      const [a, b] = [m.name, f.typeName].sort(compareStrings);
      const key2 = JSON.stringify([a, b, f.relation?.name ?? ""]);
      const end = { model: m.name, field: f.name, isList: f.isList, isOptional: f.isOptional, span: f.span };
      fieldOf.set(`${m.name}.${f.name}`, f);
      targetOf.set(`${m.name}.${f.name}`, f.typeName);
      const list = groups.get(key2) ?? [];
      list.push(end);
      groups.set(key2, list);
    }
  }
  const out = [];
  for (const [key2, ends] of groups) {
    const relName = JSON.parse(key2)[2] || void 0;
    ends.sort((x, y) => compareStrings(`${x.model}.${x.field}`, `${y.model}.${y.field}`));
    const withFields = ends.filter((e) => (fieldOf.get(`${e.model}.${e.field}`)?.relation?.fields?.length ?? 0) > 0);
    const base = { ...relName ? { name: relName } : {}, ends };
    const ownerInfo = (e) => {
      const f = fieldOf.get(`${e.model}.${e.field}`);
      return { ...e, fields: f.relation?.fields ?? [], references: f.relation?.references ?? [] };
    };
    const idOf = (e) => `${e.model}.${e.field}`;
    if (ends.length === 2) {
      const [e1, e2] = ends;
      if (withFields.length === 1) {
        const ownerEnd = withFields[0];
        const otherEnd = ownerEnd === e1 ? e2 : e1;
        const owner = ownerInfo(ownerEnd);
        const referencedModel = targetOf.get(idOf(ownerEnd));
        let reason;
        if (ownerEnd.isList) reason = "the side declaring fields/references is a list";
        else if (owner.fields.length !== owner.references.length) reason = "fields and references have different lengths";
        else if (otherEnd.model !== referencedModel || targetOf.get(idOf(otherEnd)) !== ownerEnd.model) reason = "relation ends do not point at each other";
        if (reason) {
          out.push({ id: idOf(ownerEnd), ...base, status: "ambiguous", kind: "unknown", owner, other: otherEnd, referencedModel, reason });
        } else {
          out.push({
            id: idOf(ownerEnd),
            ...base,
            status: "resolved",
            kind: otherEnd.isList ? "one_to_many" : "one_to_one",
            owner,
            other: otherEnd,
            referencedModel
          });
        }
        continue;
      }
      if (withFields.length === 0) {
        if (e1.isList && e2.isList) {
          out.push({ id: `${idOf(e1)}<->${idOf(e2)}`, ...base, status: "resolved", kind: "implicit_many_to_many" });
        } else {
          out.push({
            id: `${idOf(e1)}<->${idOf(e2)}`,
            ...base,
            status: "ambiguous",
            kind: "unknown",
            reason: "neither side declares fields/references"
          });
        }
        continue;
      }
      out.push({ id: `${idOf(e1)}<->${idOf(e2)}`, ...base, status: "ambiguous", kind: "unknown", reason: "both sides declare fields/references" });
      continue;
    }
    if (ends.length === 1) {
      const only = ends[0];
      if (withFields.length === 1 && !only.isList) {
        out.push({
          id: idOf(only),
          ...base,
          status: "ambiguous",
          kind: "unknown",
          owner: ownerInfo(only),
          referencedModel: targetOf.get(idOf(only)),
          reason: "the opposite relation field is missing, so 1:1 vs 1:n cannot be determined"
        });
      } else {
        out.push({ id: idOf(only), ...base, status: "ambiguous", kind: "unknown", reason: "the opposite relation field is missing" });
      }
      continue;
    }
    out.push({
      id: ends.map(idOf).join("<->"),
      ...base,
      status: "ambiguous",
      kind: "unknown",
      reason: `${ends.length} relation fields share this model pair and relation name; add distinct relation names`
    });
  }
  out.sort((a, b) => compareStrings(a.id, b.id));
  return out;
}

// src/prisma/tokenizer.ts
var PUNCT_SINGLE = /* @__PURE__ */ new Set(["{", "}", "(", ")", "[", "]", ",", ":", "=", "?", ".", "!"]);
function isIdentStart(ch) {
  return /[A-Za-z_]/.test(ch);
}
function isIdentPart(ch) {
  return /[A-Za-z0-9_]/.test(ch);
}
function tokenize(input) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  if (input.charCodeAt(0) === 65279) i = 1;
  const push = (type, value, sl, sc, extra) => {
    tokens.push({ type, value, line: sl, column: sc, endLine: line, endColumn: col, ...extra });
  };
  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      const ch = input[i];
      i++;
      if (ch === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
    }
  };
  while (i < input.length) {
    const ch = input[i];
    const sl = line;
    const sc = col;
    if (ch === "\r") {
      if (input[i + 1] === "\n") {
        i++;
        advance();
      } else {
        i++;
        line++;
        col = 1;
      }
      tokens.push({ type: "newline", value: "\n", line: sl, column: sc, endLine: sl, endColumn: sc + 1 });
      continue;
    }
    if (ch === "\n") {
      advance();
      tokens.push({ type: "newline", value: "\n", line: sl, column: sc, endLine: sl, endColumn: sc + 1 });
      continue;
    }
    if (ch === " " || ch === "	" || ch === "\f" || ch === "\v") {
      advance();
      continue;
    }
    if (ch === "/" && input[i + 1] === "/") {
      const start = i;
      while (i < input.length && input[i] !== "\n" && input[i] !== "\r") advance();
      push("comment", input.slice(start, i), sl, sc);
      continue;
    }
    if (ch === '"') {
      advance();
      let value = "";
      let terminated = false;
      let badEscape;
      while (i < input.length) {
        const c = input[i];
        if (c === "\n" || c === "\r") break;
        if (c === "\\") {
          const next = input[i + 1];
          if (next === void 0) {
            advance();
            break;
          }
          const map = { n: "\n", t: "	", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" };
          if (map[next] !== void 0) {
            value += map[next];
            advance(2);
            continue;
          }
          if (next === "u" && /^[0-9a-fA-F]{4}$/.test(input.slice(i + 2, i + 6))) {
            value += String.fromCharCode(Number.parseInt(input.slice(i + 2, i + 6), 16));
            advance(6);
            continue;
          }
          badEscape ??= `\\${next}`;
          value += next;
          advance(2);
          continue;
        }
        if (c === '"') {
          advance();
          terminated = true;
          break;
        }
        value += c;
        advance();
      }
      push("string", value, sl, sc, { ...terminated ? {} : { unterminated: true }, ...badEscape ? { badEscape } : {} });
      continue;
    }
    if (ch === "@") {
      if (input[i + 1] === "@") {
        advance(2);
        push("punct", "@@", sl, sc);
      } else {
        advance();
        push("punct", "@", sl, sc);
      }
      continue;
    }
    if (PUNCT_SINGLE.has(ch)) {
      advance();
      push("punct", ch, sl, sc);
      continue;
    }
    if (/[0-9]/.test(ch) || ch === "-" && /[0-9]/.test(input[i + 1] ?? "")) {
      const start = i;
      advance();
      while (i < input.length && /[0-9.eE_+-]/.test(input[i])) {
        const c = input[i];
        if ((c === "-" || c === "+") && !/[eE]/.test(input[i - 1])) break;
        advance();
      }
      push("number", input.slice(start, i), sl, sc);
      continue;
    }
    if (isIdentStart(ch)) {
      const start = i;
      while (i < input.length && isIdentPart(input[i])) advance();
      push("ident", input.slice(start, i), sl, sc);
      continue;
    }
    const cp = input.codePointAt(i) ?? 0;
    const width = cp > 65535 ? 2 : 1;
    const raw = input.slice(i, i + width);
    i += width;
    col += width;
    push("invalid", raw, sl, sc);
  }
  tokens.push({ type: "eof", value: "", line, column: col, endLine: line, endColumn: col });
  return tokens;
}

// src/prisma/parser.ts
var KNOWN_BLOCKS = /* @__PURE__ */ new Set(["model", "view", "enum", "datasource", "generator", "type"]);
var ParseError = class extends Error {
  token;
  constructor(message, token) {
    super(message);
    this.token = token;
  }
};
function parsePrismaFile(file, text) {
  const p = new Parser(file, tokenize(text));
  return p.parseFile();
}
var Parser = class {
  pos = 0;
  file;
  tokens;
  /** Set when a newline was consumed inside an argument list or array. */
  multiline = false;
  constructor(file, tokens) {
    this.file = file;
    this.tokens = tokens;
  }
  span(start, end) {
    return { file: this.file, line: start.line, column: start.column, endLine: end.endLine, endColumn: end.endColumn };
  }
  peek(offset = 0) {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }
  prev() {
    return this.tokens[Math.max(this.pos - 1, 0)];
  }
  next() {
    const t = this.peek();
    if (t.type !== "eof") this.pos++;
    return t;
  }
  isPunct(t, v) {
    return t.type === "punct" && t.value === v;
  }
  expectPunct(v) {
    const t = this.peek();
    if (!this.isPunct(t, v)) throw new ParseError(`expected "${v}" but found ${describe(t)}`, t);
    return this.next();
  }
  /** Skip newlines and comments inside brackets/parentheses (Prisma 7 itself rejects such newlines). */
  skipTrivia() {
    while (this.peek().type === "newline" || this.peek().type === "comment") {
      if (this.peek().type === "newline") this.multiline = true;
      this.pos++;
    }
  }
  /** Skip blank lines and comments between statements. */
  skipStatementTrivia() {
    while (this.peek().type === "newline" || this.peek().type === "comment") this.pos++;
  }
  diag(code, message, t, extra) {
    return { code, severity: "blocking", message, span: this.span(t, t), ...extra };
  }
  parseFile() {
    const blocks = [];
    const diagnostics = [];
    for (; ; ) {
      this.skipStatementTrivia();
      const t = this.peek();
      if (t.type === "eof") break;
      if (t.type === "invalid" && t.value === "/" && this.peek(1).value === "*") {
        diagnostics.push(this.diag("PSL_UNSUPPORTED_COMMENT", "block comments are not part of PSL", t));
        this.recoverTopLevel();
        continue;
      }
      if (t.type !== "ident") {
        diagnostics.push(this.diag("PSL_UNEXPECTED_TOKEN", `unexpected ${describe(t)} at top level`, t));
        this.recoverTopLevel();
        continue;
      }
      const keywordTok = this.next();
      const nameTok = this.peek();
      if (nameTok.type !== "ident") {
        diagnostics.push(this.diag("PSL_UNEXPECTED_TOKEN", `expected a name after "${keywordTok.value}"`, nameTok));
        this.recoverTopLevel();
        continue;
      }
      this.next();
      this.skipTrivia();
      if (!this.isPunct(this.peek(), "{")) {
        diagnostics.push(this.diag("PSL_UNEXPECTED_TOKEN", `expected "{" after ${keywordTok.value} ${nameTok.value}`, this.peek()));
        this.recoverTopLevel();
        continue;
      }
      this.next();
      const known = KNOWN_BLOCKS.has(keywordTok.value);
      const block = {
        keyword: keywordTok.value,
        name: nameTok.value,
        span: this.span(keywordTok, nameTok),
        known,
        fields: [],
        blockAttributes: [],
        properties: [],
        enumValues: [],
        diagnostics: []
      };
      if (!known) {
        diagnostics.push({
          code: "PSL_UNSUPPORTED_BLOCK",
          severity: "blocking",
          message: `block type "${keywordTok.value}" is not supported by db-preflight v0.1`,
          span: block.span
        });
        this.skipBalancedBody();
      } else {
        this.parseBody(block);
      }
      const closing = this.prev();
      block.span = this.span(keywordTok, closing);
      blocks.push(block);
    }
    return { file: this.file, blocks, diagnostics };
  }
  /** Skip to the end of the current top-level construct. */
  recoverTopLevel() {
    let depth = 0;
    for (; ; ) {
      const t = this.peek();
      if (t.type === "eof") return;
      if (this.isPunct(t, "{")) depth++;
      if (this.isPunct(t, "}")) {
        depth--;
        this.next();
        if (depth <= 0) return;
        continue;
      }
      if (t.type === "newline" && depth === 0) {
        this.next();
        return;
      }
      this.next();
    }
  }
  /** Consume tokens until the "}" that closes an already-opened block. */
  skipBalancedBody() {
    let depth = 1;
    for (; ; ) {
      const t = this.next();
      if (t.type === "eof") return;
      if (this.isPunct(t, "{")) depth++;
      if (this.isPunct(t, "}")) {
        depth--;
        if (depth === 0) return;
      }
    }
  }
  /** Skip the remainder of a statement line (respecting nesting) without consuming a closing "}". */
  skipRestOfLine() {
    let depth = 0;
    for (; ; ) {
      const t = this.peek();
      if (t.type === "eof") return;
      if (depth === 0 && (t.type === "newline" || this.isPunct(t, "}"))) return;
      if (this.isPunct(t, "(") || this.isPunct(t, "[") || this.isPunct(t, "{")) depth++;
      if (this.isPunct(t, ")") || this.isPunct(t, "]") || this.isPunct(t, "}") && depth > 0) depth--;
      this.next();
    }
  }
  atEndOfStatement() {
    const t = this.peek();
    return t.type === "newline" || t.type === "comment" || t.type === "eof" || this.isPunct(t, "}");
  }
  parseBody(block) {
    for (; ; ) {
      this.skipStatementTrivia();
      const t = this.peek();
      if (t.type === "eof") {
        block.diagnostics.push(this.diag("PSL_UNTERMINATED_BLOCK", `block ${block.keyword} ${block.name} is not closed`, t));
        return;
      }
      if (this.isPunct(t, "}")) {
        this.next();
        return;
      }
      const start = this.pos;
      this.multiline = false;
      try {
        if (this.isPunct(t, "@@")) {
          block.blockAttributes.push(this.parseAttribute());
        } else if (t.type === "ident") {
          if (block.keyword === "datasource" || block.keyword === "generator") {
            block.properties.push(this.parseProperty());
          } else if (block.keyword === "enum") {
            block.enumValues.push(this.parseEnumValue());
          } else {
            block.fields.push(this.parseField());
          }
        } else {
          throw new ParseError(`unexpected ${describe(t)} in ${block.keyword} ${block.name}`, t);
        }
        if (!this.atEndOfStatement()) {
          throw new ParseError(`unexpected ${describe(this.peek())} after statement`, this.peek());
        }
        if (this.multiline) {
          const startTok = this.tokens[start];
          block.diagnostics.push({
            code: "PSL_MULTILINE_REJECTED_BY_PRISMA",
            severity: "warning",
            message: "this statement spans several lines; db-preflight read it, but Prisma ORM 7 rejects newlines inside attribute arguments and arrays (prisma validate reports a syntax error)",
            span: this.span(startTok, this.prev()),
            model: block.name
          });
        }
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
        const startTok = this.tokens[start];
        const fieldName = startTok.type === "ident" ? startTok.value : void 0;
        block.diagnostics.push({
          code: "PSL_SYNTAX",
          severity: "blocking",
          message: e.message,
          span: this.span(e.token, e.token),
          model: block.name,
          ...fieldName && block.keyword !== "datasource" && block.keyword !== "generator" ? { field: fieldName } : {}
        });
        this.skipRestOfLine();
      }
    }
  }
  parseProperty() {
    const keyTok = this.next();
    this.expectPunct("=");
    const value = this.parseExpr();
    return { key: keyTok.value, value, span: this.span(keyTok, this.prev()) };
  }
  parseEnumValue() {
    const nameTok = this.next();
    const attributes = [];
    while (this.isPunct(this.peek(), "@")) attributes.push(this.parseAttribute());
    return { name: nameTok.value, attributes, span: this.span(nameTok, this.prev()) };
  }
  parseField() {
    const nameTok = this.next();
    const typeTok = this.peek();
    if (typeTok.type !== "ident") throw new ParseError(`expected a type for field "${nameTok.value}"`, typeTok);
    this.next();
    let typeArgs = null;
    if (this.isPunct(this.peek(), "(")) typeArgs = this.parseArgs();
    let isList = false;
    let isOptional = false;
    if (this.isPunct(this.peek(), "[")) {
      this.next();
      this.expectPunct("]");
      isList = true;
    }
    if (this.isPunct(this.peek(), "?")) {
      this.next();
      isOptional = true;
    }
    if (this.isPunct(this.peek(), "?") || this.isPunct(this.peek(), "[") || this.isPunct(this.peek(), "!")) {
      throw new ParseError(`unsupported type modifier ${describe(this.peek())} on field "${nameTok.value}"`, this.peek());
    }
    const attributes = [];
    while (this.isPunct(this.peek(), "@")) attributes.push(this.parseAttribute());
    return {
      name: nameTok.value,
      typeName: typeTok.value,
      typeArgs,
      isList,
      isOptional,
      attributes,
      span: this.span(nameTok, this.prev()),
      nameSpan: this.span(nameTok, nameTok)
    };
  }
  parseAttribute() {
    const at = this.next();
    const block = at.value === "@@";
    const first = this.peek();
    if (first.type !== "ident") throw new ParseError(`expected an attribute name after "${at.value}"`, first);
    this.next();
    let name = first.value;
    while (this.isPunct(this.peek(), ".")) {
      this.next();
      const part = this.peek();
      if (part.type !== "ident") throw new ParseError(`expected a name after "." in attribute ${at.value}${name}`, part);
      this.next();
      name += `.${part.value}`;
    }
    let args = null;
    if (this.isPunct(this.peek(), "(")) args = this.parseArgs();
    return { block, name, args, span: this.span(at, this.prev()) };
  }
  parseArgs() {
    this.expectPunct("(");
    const args = [];
    this.skipTrivia();
    while (!this.isPunct(this.peek(), ")")) {
      const start = this.peek();
      let name;
      if (start.type === "ident" && this.isPunct(this.peekSkippingTrivia(1), ":")) {
        name = this.next().value;
        this.skipTrivia();
        this.expectPunct(":");
        this.skipTrivia();
      }
      const value = this.parseExpr();
      args.push(name !== void 0 ? { name, value, span: this.span(start, this.prev()) } : { value, span: this.span(start, this.prev()) });
      this.skipTrivia();
      if (this.isPunct(this.peek(), ",")) {
        this.next();
        this.skipTrivia();
        continue;
      }
      if (!this.isPunct(this.peek(), ")")) throw new ParseError(`expected "," or ")" but found ${describe(this.peek())}`, this.peek());
    }
    this.expectPunct(")");
    return args;
  }
  peekSkippingTrivia(offset) {
    let seen = 0;
    for (let k = this.pos; k < this.tokens.length; k++) {
      const t = this.tokens[k];
      if (t.type === "newline" || t.type === "comment") continue;
      if (seen === offset) return t;
      seen++;
    }
    return this.tokens[this.tokens.length - 1];
  }
  parseExpr() {
    this.skipTrivia();
    const t = this.peek();
    if (t.type === "string") {
      if (t.unterminated) throw new ParseError("unterminated string literal", t);
      if (t.badEscape) throw new ParseError(`unsupported escape sequence ${t.badEscape} in string literal`, t);
      this.next();
      return { kind: "string", value: t.value, span: this.span(t, t) };
    }
    if (t.type === "number") {
      this.next();
      return { kind: "number", value: t.value, span: this.span(t, t) };
    }
    if (this.isPunct(t, "[")) {
      this.next();
      const items = [];
      this.skipTrivia();
      while (!this.isPunct(this.peek(), "]")) {
        items.push(this.parseExpr());
        this.skipTrivia();
        if (this.isPunct(this.peek(), ",")) {
          this.next();
          this.skipTrivia();
          continue;
        }
        if (!this.isPunct(this.peek(), "]")) throw new ParseError(`expected "," or "]" but found ${describe(this.peek())}`, this.peek());
      }
      const end = this.next();
      return { kind: "array", items, span: this.span(t, end) };
    }
    if (t.type === "ident") {
      this.next();
      let name = t.value;
      while (this.isPunct(this.peek(), ".") && this.peek(1).type === "ident") {
        this.next();
        name += `.${this.next().value}`;
      }
      if (this.isPunct(this.peek(), "(")) {
        const args = this.parseArgs();
        return { kind: "call", name, args, span: this.span(t, this.prev()) };
      }
      return { kind: "ident", name, span: this.span(t, this.prev()) };
    }
    throw new ParseError(`expected a value but found ${describe(t)}`, t);
  }
};
function describe(t) {
  switch (t.type) {
    case "eof":
      return "end of file";
    case "newline":
      return "end of line";
    case "string":
      return "string literal";
    case "invalid":
      return `unsupported character U+${(t.value.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`;
    default:
      return `"${t.value.length > 40 ? `${t.value.slice(0, 40)}…` : t.value}"`;
  }
}

// src/prisma/index.ts
function analyzePrismaSources(sources) {
  const sorted = [...sources].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const asts = sorted.map((s) => parsePrismaFile(s.path, s.text));
  const files = sorted.map((s) => {
    const buf = Buffer.from(s.text, "utf8");
    return { path: s.path, sha256: (0, import_node_crypto3.createHash)("sha256").update(buf).digest("hex"), bytes: buf.length };
  });
  return buildPrismaModel(asts, files, []);
}
function loadPrismaSchema(input) {
  const d = discoverPrismaFiles(input);
  const asts = d.files.map((f) => parsePrismaFile(f.relPath, f.text));
  const model = buildPrismaModel(
    asts,
    d.files.map((f) => ({ path: f.relPath, sha256: f.sha256, bytes: f.bytes })),
    d.skipped
  );
  return { model, inputKind: d.inputKind, files: d.files };
}
function verifyInputsUnchanged(files) {
  try {
    return files.every((f) => (0, import_node_crypto3.createHash)("sha256").update((0, import_node_fs4.readFileSync)(f.absPath)).digest("hex") === f.sha256);
  } catch {
    return false;
  }
}

// src/reporters/markdown.ts
function evidence(e) {
  if (e.kind === "prisma") return `Prisma ${mdCode(`${e.file}:${e.line}:${e.column}`)} — ${mdText(e.detail)}`;
  if (e.kind === "database") return `Database ${mdCode(e.object)} — ${mdText(e.detail)}`;
  return `Note — ${mdText(e.detail)}`;
}
function renderMarkdown(r) {
  const L = [];
  L.push(`# DB Preflight report`);
  L.push("");
  L.push(`| | |`);
  L.push(`|---|---|`);
  L.push(`| Result | **${r.result.status}** (exit code ${r.result.exitCode}) |`);
  L.push(`| Mode | ${r.mode} |`);
  L.push(`| Tool version | ${mdText(r.toolVersion)} |`);
  L.push(
    `| Prisma input | ${r.prisma.files.length} file(s), Prisma ORM ${r.prisma.ormMajorAssumed} semantics, relationMode ${mdText(r.prisma.datasource.relationMode ?? "unknown")} (${r.prisma.datasource.relationModeSource}) |`
  );
  L.push(
    `| Database metadata | ${r.database.source}${r.database.snapshotOrigin ? r.database.snapshotOrigin === "live" ? " (snapshot of a live database)" : " (synthetic snapshot)" : ""}, collected ${mdText(r.database.collectedAt)}, PostgreSQL ${mdText(r.database.serverVersion ?? "unknown")} |`
  );
  L.push(`| Schemas in scope | ${r.scope.dbSchemas.map(mdCode).join(", ")}${r.scope.defaultSchema ? ` (default schema ${mdCode(r.scope.defaultSchema)})` : ""} |`);
  L.push(`| Collection complete | ${r.database.collectionComplete ? "yes" : "**no**"} |`);
  L.push("");
  L.push(mdText(r.result.summary));
  L.push("");
  L.push(`> ${mdText(r.result.disclaimer)}`);
  L.push("");
  const byId = new Map(r.findings.map((f) => [f.id, f]));
  if (r.findingGroups.length > 0) {
    L.push(`## Findings`);
    for (const g of r.findingGroups) {
      L.push("");
      L.push(`### ${mdText(g.title)}`);
      for (const id of g.findingIds) {
        const f = byId.get(id);
        L.push("");
        L.push(`#### ${f.ruleId} (${f.severity}) — ${mdText(f.title)}`);
        L.push("");
        L.push(`Finding id ${mdCode(f.id)}${f.relatedFindingIds.length ? `; related ${f.relatedFindingIds.map(mdCode).join(", ")}` : ""}`);
        L.push("");
        L.push(`**Observed**`);
        L.push("");
        for (const o of f.explanation.observed) L.push(`- ${mdText(o)}`);
        L.push("");
        L.push(`**Expected:** ${mdText(f.explanation.expected)}`);
        L.push("");
        L.push(`**Difference:** ${mdText(f.explanation.difference)}`);
        L.push("");
        L.push(`**Impact:** ${mdText(f.explanation.impact)}`);
        L.push("");
        L.push(`**Evidence**`);
        L.push("");
        for (const e of f.evidence) L.push(`- ${evidence(e)}`);
        L.push("");
        L.push(`**Options for a human to review** (not automatic fixes)`);
        L.push("");
        for (const o of f.reviewOptions) L.push(`- ${mdText(o)}`);
        L.push("");
        L.push(`**Not checked**`);
        L.push("");
        for (const o of f.explanation.notChecked) L.push(`- ${mdText(o)}`);
      }
    }
    L.push("");
  }
  const unknown = r.checks.filter((c) => c.status === "unknown");
  if (unknown.length > 0) {
    L.push(`## Unknown checks (${unknown.length})`);
    L.push("");
    L.push("These were not evaluated and are **not** treated as passing.");
    L.push("");
    L.push("| Rule | Subject | Reason |");
    L.push("|---|---|---|");
    for (const u of unknown) L.push(`| ${u.ruleId} | ${mdCode(u.subject)} | ${mdText(u.reason ?? u.reasonCode ?? "")} |`);
    L.push("");
  }
  if (r.prisma.diagnostics.length > 0) {
    L.push(`## Prisma schema diagnostics`);
    L.push("");
    for (const d of r.prisma.diagnostics) {
      L.push(`- **${d.severity}** ${d.span ? `${mdCode(`${d.span.file}:${d.span.line}:${d.span.column}`)} ` : ""}${mdText(d.code)}: ${mdText(d.message)}`);
    }
    L.push("");
  }
  const tot = r.coverage.totals;
  L.push(`## Coverage`);
  L.push("");
  L.push(`| Checks | Pass | Fail | Unknown | Not applicable | Complete within scope |`);
  L.push(`|---|---|---|---|---|---|`);
  L.push(`| ${tot.checks} | ${tot.pass} | ${tot.fail} | ${tot.unknown} | ${tot.not_applicable} | ${r.coverage.completeWithinScope ? "yes" : "no"} |`);
  L.push("");
  L.push(`Not covered by this tool:`);
  L.push("");
  for (const n of r.coverage.notCovered) L.push(`- ${mdText(n)}`);
  L.push("");
  L.push(`## Safety`);
  L.push("");
  L.push(`- Database access: ${r.safety.databaseAccess}`);
  L.push(`- Read-only transaction verified: ${r.safety.readOnlyTransactionVerified === null ? "n/a" : r.safety.readOnlyTransactionVerified ? "yes" : "no"}`);
  L.push(
    `- Prisma input files unchanged (re-hashed after analysis): ${r.safety.prismaInputsUnchangedVerified === null ? "n/a" : r.safety.prismaInputsUnchangedVerified ? "yes" : "no"}`
  );
  L.push(`- LLM or network calls by the tool: none`);
  return `${L.join("\n")}
`;
}

// src/reporters/text.ts
var RESULT_LABEL = {
  mismatch_found: "MISMATCH FOUND",
  inconclusive: "INCONCLUSIVE",
  no_mismatch_in_checked_scope: "NO MISMATCH IN CHECKED SCOPE"
};
function evidenceLine(e) {
  if (e.kind === "prisma") return `prisma  ${safeText(e.file)}:${e.line}:${e.column}  ${safeText(e.detail)}`;
  if (e.kind === "database") return `db      ${safeText(e.object)}  ${safeText(e.detail)}`;
  return `note    ${safeText(e.detail)}`;
}
function renderText(r, opts) {
  const max = opts.maxListed ?? 25;
  const c = (code, s) => opts.color ? `\x1B[${code}m${s}\x1B[0m` : s;
  const red = (s) => c("31;1", s);
  const yellow = (s) => c("33", s);
  const green = (s) => c("32", s);
  const bold = (s) => c("1", s);
  const L = [];
  L.push(bold(`DB Preflight ${safeText(r.toolVersion)} - ${r.mode === "demo" ? "demo (built-in synthetic data, no database)" : `scan (${r.mode})`}`));
  L.push(
    `Prisma:   ${r.prisma.files.length} file(s) from a ${r.prisma.inputKind}; evaluated with Prisma ORM ${r.prisma.ormMajorAssumed} semantics; relationMode ${safeText(r.prisma.datasource.relationMode ?? "unknown")} (${r.prisma.datasource.relationModeSource})`
  );
  L.push(
    `Database: ${r.database.source}${r.database.snapshotOrigin ? r.database.snapshotOrigin === "live" ? " (snapshot of a live database)" : " (synthetic snapshot)" : ""}, collected ${safeText(r.database.collectedAt)}, PostgreSQL ${safeText(r.database.serverVersion ?? "unknown")}, schemas [${r.scope.dbSchemas.map(safeText).join(", ")}], collection ${r.database.collectionComplete ? "complete" : "INCOMPLETE"}`
  );
  if (r.scope.defaultSchema) L.push(`          --default-schema ${safeText(r.scope.defaultSchema)}`);
  L.push(`          ${safeText(r.database.note)}`);
  L.push("");
  const label = RESULT_LABEL[r.result.status];
  const colored = r.result.status === "mismatch_found" ? red(label) : r.result.status === "inconclusive" ? yellow(label) : green(label);
  L.push(`RESULT: ${colored} (exit code ${r.result.exitCode})`);
  L.push(`  ${safeText(r.result.summary)}`);
  L.push("");
  const byId = new Map(r.findings.map((f) => [f.id, f]));
  r.findingGroups.forEach((g, gi) => {
    L.push(bold(`[${gi + 1}] ${safeText(g.title)}`));
    for (const id of g.findingIds) {
      const f = byId.get(id);
      L.push(`  ${f.severity === "error" ? red("[FAIL]") : yellow("[WARN]")} ${f.ruleId} ${safeText(f.title)}`);
      L.push(`     id: ${f.id}${f.relatedFindingIds.length ? `  related: ${f.relatedFindingIds.join(", ")}` : ""}`);
      L.push("     Observed:");
      for (const o of f.explanation.observed) L.push(`       - ${safeText(o)}`);
      L.push(`     Expected:   ${safeText(f.explanation.expected)}`);
      L.push(`     Difference: ${safeText(f.explanation.difference)}`);
      L.push(`     Impact:     ${safeText(f.explanation.impact)}`);
      L.push("     Evidence:");
      for (const e of f.evidence) L.push(`       - ${evidenceLine(e)}`);
      L.push("     Options for a human to review (not automatic fixes):");
      for (const o of f.reviewOptions) L.push(`       - ${safeText(o)}`);
      L.push("     Not checked:");
      for (const o of f.explanation.notChecked) L.push(`       - ${safeText(o)}`);
    }
    L.push("");
  });
  const unknown = r.checks.filter((x) => x.status === "unknown");
  if (unknown.length > 0) {
    L.push(bold(`Unknown checks (${unknown.length}) - not evaluated, NOT treated as passing:`));
    for (const u of unknown.slice(0, max)) L.push(`  ${yellow("[?]")} ${u.ruleId} ${safeText(u.subject)}: ${safeText(u.reason ?? u.reasonCode ?? "")}`);
    if (unknown.length > max) L.push(`  ... and ${unknown.length - max} more (use --format json for the full list)`);
    L.push("");
  }
  const diags = r.prisma.diagnostics;
  if (diags.length > 0) {
    L.push(bold(`Prisma schema diagnostics (${diags.length}):`));
    for (const d of diags.slice(0, max)) {
      const where = d.span ? `${safeText(d.span.file)}:${d.span.line}:${d.span.column} ` : "";
      L.push(`  ${d.severity === "blocking" ? yellow("[blocking]") : "[" + d.severity + "]"} ${where}${d.code}: ${safeText(d.message)}`);
    }
    if (diags.length > max) L.push(`  ... and ${diags.length - max} more`);
    L.push("");
  }
  if (r.prisma.skipped.length > 0) {
    L.push(`Skipped inputs: ${r.prisma.skipped.map((s) => `${safeText(s.path)} (${safeText(s.reason)})`).join("; ")}`);
    L.push("");
  }
  if (r.database.gaps.length > 0) {
    L.push(`Collection gaps: ${r.database.gaps.map((g) => `${safeText(g.scope)}: ${safeText(g.reason)}`).join("; ")}`);
    L.push("");
  }
  const tot = r.coverage.totals;
  L.push(
    `Coverage: ${tot.checks} checks - pass ${tot.pass}, fail ${tot.fail}, unknown ${tot.unknown}, not applicable ${tot.not_applicable}. Complete within scope: ${r.coverage.completeWithinScope ? "yes" : "no"}.`
  );
  L.push("Not covered by this tool:");
  for (const n of r.coverage.notCovered) L.push(`  - ${safeText(n)}`);
  L.push("");
  L.push(
    `Safety: database access ${r.safety.databaseAccess}; read-only transaction verified: ${fmtBool(r.safety.readOnlyTransactionVerified)}; Prisma input files unchanged (re-hashed): ${fmtBool(r.safety.prismaInputsUnchangedVerified)}; LLM/network calls: none.`
  );
  L.push(`Note: ${safeText(r.result.disclaimer)}`);
  return `${L.join("\n")}
`;
}
function fmtBool(v) {
  return v === null ? "n/a" : v ? "yes" : "no";
}

// src/cli/output.ts
var import_node_crypto4 = require("node:crypto");
var import_node_fs5 = require("node:fs");
var import_node_path2 = require("node:path");
function canonical(p) {
  const abs = (0, import_node_path2.resolve)(p);
  let dir;
  try {
    dir = import_node_fs5.realpathSync.native((0, import_node_path2.dirname)(abs));
  } catch {
    throw new DbpError("OUT_DIR_MISSING", "--out directory does not exist");
  }
  const full = (0, import_node_path2.resolve)(dir, (0, import_node_path2.basename)(abs));
  return process.platform === "win32" || process.platform === "darwin" ? full.toLowerCase() : full;
}
function checkOutPath(out, inputs, force) {
  if (out.toLowerCase().endsWith(".prisma")) {
    throw new DbpError("OUT_IS_PRISMA", "--out must not be a .prisma file");
  }
  const target = canonical(out);
  const inputSet = new Set(
    inputs.map((p) => {
      try {
        return canonical(p);
      } catch {
        return (0, import_node_path2.resolve)(p);
      }
    })
  );
  if (inputSet.has(target)) {
    throw new DbpError("OUT_IS_INPUT", "--out must not point at an input file (Prisma schema or snapshot)");
  }
  if ((0, import_node_fs5.existsSync)(out) || lstatExists(out)) {
    const st = (0, import_node_fs5.lstatSync)(out);
    if (st.isSymbolicLink()) throw new DbpError("OUT_IS_SYMLINK", "--out must not be a symbolic link");
    if (!st.isFile()) throw new DbpError("OUT_NOT_FILE", "--out exists and is not a regular file");
    for (const i of inputs) {
      try {
        const s = (0, import_node_fs5.statSync)(i);
        if (s.ino === st.ino && s.dev === st.dev && st.ino !== 0) {
          throw new DbpError("OUT_IS_INPUT", "--out is a hard link to an input file");
        }
      } catch (e) {
        if (e instanceof DbpError) throw e;
      }
    }
    if (!force) throw new DbpError("OUT_EXISTS", "--out file already exists; pass --force to overwrite it");
  }
}
function lstatExists(p) {
  try {
    (0, import_node_fs5.lstatSync)(p);
    return true;
  } catch {
    return false;
  }
}
function writeOut(out, content, force, inputs = []) {
  const abs = (0, import_node_path2.resolve)(out);
  const tmp = (0, import_node_path2.join)((0, import_node_path2.dirname)(abs), `.${(0, import_node_path2.basename)(abs)}.${(0, import_node_crypto4.randomBytes)(6).toString("hex")}.tmp`);
  let fd;
  try {
    fd = (0, import_node_fs5.openSync)(tmp, "wx", 384);
  } catch (e) {
    throw new DbpError("OUT_WRITE_FAILED", `could not write next to the --out file (${e.code ?? "error"})`);
  }
  try {
    try {
      (0, import_node_fs5.writeSync)(fd, content);
    } finally {
      (0, import_node_fs5.closeSync)(fd);
    }
    checkOutPath(out, inputs, force);
    if (force) {
      (0, import_node_fs5.renameSync)(tmp, abs);
      return;
    }
    try {
      (0, import_node_fs5.linkSync)(tmp, abs);
    } catch (e) {
      const code = e.code;
      if (code === "EEXIST") throw new DbpError("OUT_EXISTS", "--out file already exists; pass --force to overwrite it");
      const out2 = (0, import_node_fs5.openSync)(abs, "wx", 384);
      try {
        (0, import_node_fs5.writeSync)(out2, content);
      } finally {
        (0, import_node_fs5.closeSync)(out2);
      }
    }
  } finally {
    (0, import_node_fs5.rmSync)(tmp, { force: true });
  }
}

// src/cli/main.ts
var HELP = `db-preflight ${TOOL_VERSION} - evidence-first PostgreSQL / Prisma ORM 7 diagnostics

Usage:
  db-preflight demo [--scenario broken|healthy] [--format text|json|markdown] [--out FILE] [--force]
  db-preflight scan --schema PATH --snapshot FILE [--default-schema NAME] [--schemas a,b] [--format F] [--out FILE] [--force]
  db-preflight scan --schema PATH --live --schemas a,b [--db-url-env NAME] [--default-schema NAME] [--timeout-ms N] [--format F] [--out FILE] [--force]
  db-preflight snapshot --live --schemas a,b [--db-url-env NAME] [--timeout-ms N] [--out FILE] [--force]
  db-preflight --help | --version

Options:
  --schema PATH        A .prisma file or a directory of .prisma files (required for scan).
                       prisma.config.* is never loaded or executed.
  --snapshot FILE      Offline scan against a db-preflight snapshot JSON file.
  --live               Read catalog metadata from a live database (explicit opt-in).
  --schemas a,b        Database schemas to inspect (required with --live).
  --db-url-env NAME    NAME of the environment variable holding the connection URL
                       (default ${DEFAULT_URL_ENV}). Never pass the URL itself. .env files are not read.
  --default-schema N   Database schema for models without @@schema. Never guessed.
  --format F           text (default), json (exactly one JSON document on stdout) or markdown.
  --out FILE           Write the result to FILE instead of stdout. Refuses to overwrite unless --force;
                       never writes onto an input or a .prisma file.
  --timeout-ms N       Overall live collection timeout (default 30000).

Exit codes: 0 no mismatch in the checked scope; 1 mismatch found; 2 error; 3 inconclusive (unknown checks).
Results cover only supported checks; they are not a guarantee that the database or a migration is safe.
`;
var defaultIo = {
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s)
};
function parseList(v, flag) {
  if (v === void 0) return void 0;
  const list = v.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (list.length === 0) throw new DbpError("USAGE", `${flag} needs at least one name`);
  for (const s of list) if (s.length > 63 * 4) throw new DbpError("USAGE", `${flag} contains an overly long name`);
  return [...new Set(list)];
}
function parseFormat(v) {
  if (v === void 0) return "text";
  if (v === "text" || v === "json" || v === "markdown") return v;
  throw new DbpError("USAGE", "--format must be text, json or markdown");
}
function render(report, format, color) {
  if (format === "json") return `${JSON.stringify(report, null, 2)}
`;
  if (format === "markdown") return renderMarkdown(report);
  return renderText(report, { color });
}
function useColor() {
  return !!process.stdout.isTTY && process.env.NO_COLOR === void 0 && process.env.TERM !== "dumb";
}
async function main(argv, io = defaultIo) {
  const [command, ...rest] = argv;
  if (command === "__live-worker") return runLiveWorker();
  if (command === void 0) {
    io.stderr(`db-preflight: error [USAGE]: no command given

${HELP}`);
    return 2;
  }
  if (command === "--help" || command === "-h" || command === "help") {
    io.stdout(HELP);
    return 0;
  }
  if (command === "--version" || command === "-v") {
    io.stdout(`${TOOL_VERSION}
`);
    return 0;
  }
  let format = "text";
  try {
    const { values } = (0, import_node_util.parseArgs)({
      args: rest,
      strict: true,
      allowPositionals: false,
      options: {
        help: { type: "boolean", short: "h" },
        schema: { type: "string" },
        snapshot: { type: "string" },
        live: { type: "boolean" },
        schemas: { type: "string" },
        "db-url-env": { type: "string" },
        "default-schema": { type: "string" },
        format: { type: "string" },
        out: { type: "string" },
        force: { type: "boolean" },
        scenario: { type: "string" },
        "timeout-ms": { type: "string" }
      }
    });
    format = parseFormat(values.format);
    if (values.help) {
      io.stdout(HELP);
      return 0;
    }
    const force = values.force === true;
    const timeoutMs = values["timeout-ms"] === void 0 ? 3e4 : Number.parseInt(values["timeout-ms"], 10);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 6e5) throw new DbpError("USAGE", "--timeout-ms must be between 100 and 600000");
    if (command === "demo") {
      for (const k of ["schema", "snapshot", "live", "schemas", "db-url-env", "default-schema", "timeout-ms"]) {
        if (values[k] !== void 0) throw new DbpError("USAGE", `demo does not accept --${k}; it uses built-in synthetic data only`);
      }
      const scenarioName = values.scenario ?? "broken";
      if (scenarioName !== "broken" && scenarioName !== "healthy") throw new DbpError("USAGE", "--scenario must be broken or healthy");
      if (values.out) checkOutPath(values.out, [], force);
      const sc = DEMO_SCENARIOS[scenarioName];
      const prisma = analyzePrismaSources(sc.sources);
      const db = snapshotToDatabaseModel(parseSnapshot(sc.snapshot), "demo");
      const report = buildReport({
        mode: "demo",
        inputKind: sc.inputKind,
        prisma,
        db,
        defaultSchema: sc.defaultSchema,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        safety: { databaseAccess: "none", readOnlyTransactionVerified: null, roleVerifiedNotSuperuser: null, catalogQueryIdsExecuted: null }
      });
      report.safety.prismaInputsUnchangedVerified = null;
      return emit(report, format, values.out, force, io);
    }
    if (command === "scan") {
      if (values.scenario !== void 0) throw new DbpError("USAGE", "--scenario is only valid for demo");
      if (!values.schema) throw new DbpError("USAGE", "scan requires --schema PATH (a .prisma file or directory)");
      const hasSnapshot = values.snapshot !== void 0;
      const live = values.live === true;
      if (hasSnapshot === live) throw new DbpError("USAGE", "scan requires exactly one of --snapshot FILE or --live");
      const schemas = parseList(values.schemas, "--schemas");
      if (live && !schemas) throw new DbpError("USAGE", "--live requires --schemas (the database schemas to inspect)");
      if (!live && values["db-url-env"] !== void 0) throw new DbpError("USAGE", "--db-url-env is only valid with --live");
      const envName = validateEnvName(values["db-url-env"] ?? DEFAULT_URL_ENV);
      const defaultSchema = values["default-schema"] ?? null;
      if (defaultSchema !== null && defaultSchema.trim() === "") throw new DbpError("USAGE", "--default-schema must not be empty");
      const loaded = loadPrismaSchema(values.schema);
      const provider = loaded.model.datasource?.provider;
      if (provider !== void 0 && provider !== "postgresql" && provider !== "postgres") {
        throw new DbpError("UNSUPPORTED_PROVIDER", `datasource provider "${safeText(provider)}" is not supported; v0.1 supports PostgreSQL only`);
      }
      const inputs = loaded.files.map((f) => f.absPath);
      if (hasSnapshot) inputs.push((0, import_node_path3.resolve)(values.snapshot));
      if (values.out) checkOutPath(values.out, inputs, force);
      let db;
      let safety;
      if (hasSnapshot) {
        db = snapshotToDatabaseModel(loadSnapshotFile(values.snapshot), "snapshot");
        if (schemas) db = restrictScope(db, schemas);
        safety = { databaseAccess: "none", readOnlyTransactionVerified: null, roleVerifiedNotSuperuser: null, catalogQueryIdsExecuted: null };
      } else {
        io.stderr(`db-preflight: reading catalog metadata (read-only) for schemas [${schemas.map(safeText).join(", ")}] using ${envName}
`);
        const res = await collectLiveViaWorker({ envName, schemas, timeoutMs });
        for (const w of res.warnings) io.stderr(`db-preflight: warning: ${safeText(w)}
`);
        db = res.db;
        safety = {
          databaseAccess: "live_catalog_metadata",
          readOnlyTransactionVerified: res.readOnlyVerified,
          roleVerifiedNotSuperuser: true,
          catalogQueryIdsExecuted: res.executed
        };
      }
      const report = buildReport({
        mode: hasSnapshot ? "snapshot" : "live",
        inputKind: loaded.inputKind,
        prisma: loaded.model,
        db,
        defaultSchema,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        safety
      });
      report.safety.prismaInputsUnchangedVerified = verifyInputsUnchanged(loaded.files);
      return emit(report, format, values.out, force, io, inputs);
    }
    if (command === "snapshot") {
      if (values.live !== true) throw new DbpError("USAGE", "snapshot requires --live (explicit opt-in to connect)");
      for (const k of ["schema", "snapshot", "default-schema", "scenario"]) {
        if (values[k] !== void 0) throw new DbpError("USAGE", `snapshot does not accept --${k}`);
      }
      if (values.format !== void 0 && values.format !== "json") throw new DbpError("USAGE", "snapshot output is always JSON");
      format = "json";
      const schemas = parseList(values.schemas, "--schemas");
      if (!schemas) throw new DbpError("USAGE", "snapshot requires --schemas (the database schemas to inspect)");
      const envName = validateEnvName(values["db-url-env"] ?? DEFAULT_URL_ENV);
      if (values.out) checkOutPath(values.out, [], force);
      io.stderr(`db-preflight: reading catalog metadata (read-only) for schemas [${schemas.map(safeText).join(", ")}] using ${envName}
`);
      const res = await collectLiveViaWorker({ envName, schemas, timeoutMs });
      for (const w of res.warnings) io.stderr(`db-preflight: warning: ${safeText(w)}
`);
      const json = `${JSON.stringify(databaseModelToSnapshot(res.db), null, 2)}
`;
      if (values.out) {
        writeOut(values.out, json, force);
        io.stderr(
          `db-preflight: snapshot written (collection ${res.db.complete ? "complete" : "INCOMPLETE"}). It contains schema metadata, which may be sensitive; keep it out of version control.
`
        );
      } else {
        io.stdout(json);
      }
      return res.db.complete ? 0 : 3;
    }
    throw new DbpError("USAGE", `unknown command "${safeText(redact(command)).slice(0, 40)}"; run db-preflight --help`);
  } catch (e) {
    const code = e instanceof DbpError ? e.code : e.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION" ? "USAGE" : "INTERNAL";
    const message = redact(e instanceof DbpError ? e.message : formatError(e));
    io.stderr(`db-preflight: error [${code}]: ${safeText(message)}
`);
    if (format === "json") {
      io.stdout(`${JSON.stringify({ error: { code, message: safeText(message) }, exitCode: 2 })}
`);
    }
    return 2;
  }
}
function emit(report, format, out, force, io, inputs = []) {
  const text = render(report, format, out ? false : useColor());
  if (out) {
    writeOut(out, text, force, inputs);
    io.stderr(`db-preflight: ${report.result.status} (exit ${report.result.exitCode}); report written to the --out file
`);
  } else {
    io.stdout(text);
  }
  return report.result.exitCode;
}

// src/cli/bin.ts
main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (e) => {
    process.stderr.write(`db-preflight: error [INTERNAL]: ${safeText(formatError(e))}
`);
    process.exitCode = 2;
  }
);
