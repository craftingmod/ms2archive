export type WorkerReturn<O> = {
  result: O,
  workIndex: number,
  error?: string | null,
}

export type WorkerInput<I> = {
  workIndex: number,
  data: I,
}

export class WorkerHelperLegacy<I, O> {
  public readonly workers: Worker[]
  public onCompleteOne?: (value: O | null, done: number) => unknown

  private inputIndex = 0
  private completeCount = 0
  private outputs: (O | null)[] = []
  private res?: (results: (O | null)[]) => unknown
  private inputs: I[] = []


  public constructor(
    protected scriptURL: URL,
    protected threads: number,
  ) {
    this.workers = new Array(this.threads)
    for (let i = 0; i < this.threads; i += 1) {
      const worker = new Worker(scriptURL, {
        type: "module",
      })
      worker.onmessage = (ev) => this.handleWorkerMessage(ev)
      this.workers[i] = worker
    }
  }

  public async request(inputs: I[]) {
    return new Promise<(O | null)[]>((res) => {
      this.requestInternal(inputs, res)
    })
  }

  private requestInternal(inputs: I[], res: (results: (O | null)[]) => unknown) {
    if (inputs.length <= 0) {
      res([])
      return
    }

    this.inputs = inputs
    this.outputs = new Array<O | null>(inputs.length)
    this.inputIndex = 0
    this.completeCount = 0
    this.res = res

    for (let i = 0; i < Math.min(this.threads, inputs.length); i += 1) {
      this.sendNextTask(this.workers[i])
    }

  }

  /**
   * Worker message handling
   * @param ev Event
   */
  private handleWorkerMessage(ev: MessageEvent) {
    const data = ev.data as WorkerReturn<O>

    let result = null as O | null
    if (data.error != null) {
      console.error(data.error)
    } else {
      result = data.result
    }
    this.outputs[data.workIndex] = result

    if (this.onCompleteOne != null) {
      this.onCompleteOne(result, this.completeCount)
    }
    this.completeCount += 1

    if (this.completeCount >= this.inputs.length - 1) {
      this.res?.(this.outputs)
      return
    }

    this.sendNextTask(ev.target as Worker)
  }

  private sendNextTask(worker: Worker) {
    if (this.inputIndex >= this.inputs.length) {
      return
    }
    worker.postMessage({
      workIndex: this.inputIndex,
      data: this.inputs[this.inputIndex],
    } satisfies WorkerInput<I>)
    this.inputIndex += 1
  }

  public close() {
    for (const worker of this.workers) {
      worker.terminate()
    }
  }
}

export class SmallWorkerHelper<I> {
  public readonly workers: Worker[]
  protected workerIndex = 0

  public constructor(
    protected scriptURL: URL,
    protected threads: number,
  ) {
    this.workers = new Array(this.threads)

    if (typeof scriptURL === "string") {
      this.scriptURL = new URL(scriptURL, import.meta.url)
    }

    for (let i = 0; i < this.threads; i += 1) {
      const worker = new Worker(this.scriptURL, {
        type: "module",
      })
      this.workers[i] = worker
    }
  }

  public request(inputs: I[]) {
    if (inputs.length <= 0) {
      return
    }
    for (let i = 0; i < inputs.length; i += 1) {
      const workIndex = this.workerIndex + i
      const worker = this.workers[workIndex % this.threads]

      worker.postMessage({
        workIndex: workIndex,
        data: inputs[i],
      } satisfies WorkerInput<I>)
      this.workerIndex += 1
    }
  }

  public close() {
    for (const worker of this.workers) {
      worker.terminate()
    }
  }
}

export class LargeWorkerHelper<I, O> {

  public readonly workers: Worker[]

  public onError: ((err: string, input: I) => Promise<void> | void) | null = null
  public onResult: ((result: O, input: I, inputIndex: number) => Promise<void> | void) | null = null
  public onDone: (() => Promise<void> | void) | null = null

  protected workIndex = 0
  protected outputCounts = 0

  protected inputArray = new Array<I>()
  protected outputArray = new Array<O | null>()

  public constructor(
    protected scriptURL: URL | string,
    protected readonly threads: number,
  ) {
    this.workers = new Array(this.threads)

    if (typeof scriptURL === "string") {
      this.scriptURL = new URL(scriptURL, import.meta.url)
    }

    for (let i = 0; i < this.threads; i += 1) {
      const worker = new Worker(this.scriptURL, {
        type: "module",
      })
      this.workers[i] = worker
    }

    for (let i = 0; i < this.threads; i += 1) {
      const worker = this.workers[i]
      worker.onmessage = (ev) => this.handleWorkerMessage(ev, worker)
    }
  }



  public request(inputs: I[]) {
    if (inputs.length <= 0) {
      return
    }
    this.inputArray = [...inputs]
    this.outputArray = new Array(inputs.length)

    this.workIndex = 0
    this.outputCounts = 0

    const firstLength = Math.min(inputs.length, this.threads)
    
    for (let i = 0; i < firstLength; i += 1) {
      const worker = this.workers[i]

      this.sendTask(worker)
      this.workIndex += 1
    }
  }

  protected async handleWorkerMessage(ev: MessageEvent<WorkerReturn<O>>, worker: Worker) {
    const { result, workIndex, error } = ev.data

    this.outputArray[this.outputCounts] = result
    this.outputCounts += 1

    if (this.outputCounts >= this.inputArray.length) {
      await this.onDone?.()
      this.close()
      return
    }

    const messageInput = this.inputArray[workIndex]

    if (error != null) {
      await this.onError?.(error as string, messageInput)
    } else {
      await this.onResult?.(result, messageInput, workIndex)
    }

    if (this.workIndex < this.inputArray.length) {
      // next message
      this.sendTask(worker)
      this.workIndex += 1
    }

  }

  public static handleOnMessage<I, O>(func: (input: I) => O | Promise<O>) {
    return (async (ev: Bun.BunMessageEvent) => {
      const { data, workIndex } = ev.data as WorkerInput<I>
      let errorStr = null as string | null
      let result = null as O | null

      try {
        result = await func(data)
      } catch (err) {
        errorStr = String(err)
      } finally {
        postMessage({
          result,
          workIndex,
          error: errorStr,
        } satisfies WorkerReturn<O | null>)
      }
    })
  }

  protected sendTask(worker: Worker) {
    worker.postMessage({
      data: this.inputArray[this.workIndex],
      workIndex: this.workIndex,
    } satisfies WorkerInput<I>)
  }

  public close() {
    for (const worker of this.workers) {
      worker.terminate()
    }
  }
}