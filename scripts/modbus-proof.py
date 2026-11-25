"""Independent Modbus TCP readback for the isolated mock PLC only."""
import argparse
import json
import socket
import struct
import time


def exchange(port, function, address, value):
    pdu = struct.pack(">BHH", function, address, value)
    with socket.create_connection(("127.0.0.1", port), timeout=3) as sock:
        sock.sendall(struct.pack(">HHHB", 1, 0, len(pdu) + 1, 1) + pdu)
        stream = sock.makefile("rb")
        header = stream.read(7)
        if len(header) != 7:
            raise RuntimeError("Incomplete Modbus header")
        tx, proto, length, unit = struct.unpack(">HHHB", header)
        if (tx, proto, unit) != (1, 0, 1) or not 2 <= length <= 254:
            raise RuntimeError("Invalid Modbus header")
        reply = stream.read(length - 1)
        if len(reply) != length - 1 or reply[0] != function:
            raise RuntimeError(f"Invalid Modbus response: {reply.hex()}")
        return reply


def read(port, address):
    reply = exchange(port, 3, address, 1)
    if len(reply) != 4 or reply[1] != 2:
        raise RuntimeError("Invalid read response")
    return struct.unpack(">H", reply[2:])[0]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, required=True)
    p.add_argument("--register", type=int, required=True)
    p.add_argument("--value", type=int, required=True)
    p.add_argument("--duration", type=float, default=45)
    a = p.parse_args()
    before = read(a.port, a.register)
    if before == a.value:
        raise RuntimeError("Injection would not create drift")
    reply = exchange(a.port, 6, a.register, a.value)
    if reply != struct.pack(">BHH", 6, a.register, a.value):
        raise RuntimeError("Write was not acknowledged")
    deadline = time.monotonic() + a.duration
    samples = []
    while time.monotonic() < deadline:
        samples.append(read(a.port, a.register))
        time.sleep(1)
    print(json.dumps({"register": a.register, "before": before,
                      "samples": samples, "after": read(a.port, a.register)}))


if __name__ == "__main__":
    main()
