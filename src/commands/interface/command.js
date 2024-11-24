export default class Command {
  constructor({ data, cooldown = 0, execute }) {
    this.data = data;
    this.cooldown = cooldown;
    this.execute = execute;
  }
}
