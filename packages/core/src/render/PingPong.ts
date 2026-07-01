export class PingPong<T> {
  constructor(
    public read: T,
    public write: T,
  ) {}

  swap(): void {
    const nextRead = this.write;
    this.write = this.read;
    this.read = nextRead;
  }
}
