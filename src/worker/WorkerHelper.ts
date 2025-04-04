export type WorkerReturn<O> = {
  result: O,
  workIndex: number,
  error?: string | null,
}

export type WorkerInput<I> = {
  workIndex: number,
  data: I,
}

export class WorkerHelper<I, O> {
  public readonly workers: Worker[]
  public onCompleteOne?:(value: O | null, done: number) => unknown
  public constructor(
    protected scriptURL: URL,
    protected threads: number,
  ) {
    this.workers = new Array(this.threads)
    for (let i = 0; i < this.threads; i += 1) {
      const worker = new Worker(scriptURL, {
        type: "module",
      })
      this.workers[i] = worker
    }
  }

  public async request(inputs: I[]) {
    return new Promise<(O | null)[]>((res) => {
      this.requestInternal(inputs, res)
    })
  }

  public requestInternal(inputs: I[], res: (results: (O | null)[]) => unknown) {
    console.log(inputs.length)
    if (inputs.length <= 0) {
      res([])
      return
    }

    const outputs = new Array<O | null>(inputs.length)
    // Input Index
    let inputIndex = 0
    // Complete count
    let completeCount = 0

    for (let i = 0; i < this.threads; i += 1) {
      const worker = this.workers[i]
      // 처리부분 등록
      worker.onmessage = (ev) => {
        const data = ev.data as WorkerReturn<O>

        // 에러 처리
        let result = null as O | null
        if (data.error != null) {
          console.error(data.error)
        } else {
          result = data.result
        }
        outputs[data.workIndex] = result
        
        // 핸들링
        if (this.onCompleteOne != null) {
          this.onCompleteOne(result, completeCount)
        }
        completeCount += 1
        
        // 자신이 마지막인지 체크
        if (data.workIndex >= inputs.length - 1) {
          // this.close()
          res(outputs)
        }

        // 인덱스 +1
        inputIndex += 1
        if (inputIndex >= inputs.length) {
          return
        }
        
        // 다음 Input 처리
        worker.postMessage({
          workIndex: inputIndex,
          data: inputs[inputIndex],
        } satisfies WorkerInput<I>)
      }
      if (i >= inputs.length) {
        continue
      }
      // worker 실행
      worker.postMessage({
        workIndex: inputIndex,
        data: inputs[inputIndex],
      } satisfies WorkerInput<I>)
      inputIndex += 1
    }
  }

  public close() {
    for (const worker of this.workers) {
      worker.terminate()
    }
  }
}