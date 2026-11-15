# Azure DevOps pipeline reference

The [pipeline](../azure-pipelines.yml) runs the same `npm run verify` command as local verification. It installs Node 24 and all three browsers, checks types/lint/formatting, runs unit tests and then executes the API and browser suites. The included target uses synthetic accounts and local HTTP; no service connection or application secret is needed.

## Results and artifacts

`PublishTestResults@2` publishes `test-results/junit.xml` into the pipeline's test results. Failed tests, a missing result file or a publication failure fail that task. The verification step's failure remains a job failure; there is no `continueOnError` or automatic test retry.

Report collection runs after success or failure and retains any available Playwright HTML report, failure attachments and Allure result files. Cancellation may interrupt collection. The artifact is diagnostic evidence, not a replacement for the test outcome. A source-check failure can leave no browser report; missing JUnit then fails explicitly rather than presenting an empty successful run.

Allure result files are inputs to report generation. This reference does not install an Azure marketplace extension or publish an interactive Allure tab. To generate HTML locally after downloading the results, use Java 17+ and `npx allure generate allure-results --clean -o allure-report`. Configure artifact retention to your project's policy before using a real application; browser reports can contain page content and credentials.

## Setup and validation

Connect an authorized Azure Pipelines project to this GitHub repository and select `azure-pipelines.yml`. Azure Repos uses branch build-validation policies for PR validation; the YAML `pr` trigger here applies to the GitHub connection. The hosted pool needs permission and available parallel capacity.

This is an original public reference configuration. Its commands match the locally verified suite, and task inputs were checked against Microsoft documentation. It has not been executed in Azure DevOps, so there is no hosted Azure run or interactive-report claim for this repository. The passing GitHub runs remain the public execution evidence.

- [Node setup task](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/use-node-v1?view=azure-pipelines)
- [Publish test results](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/publish-test-results-v2?view=azure-pipelines)
- [Publish pipeline artifacts](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/publish-pipeline-artifact-v1?view=azure-pipelines)
