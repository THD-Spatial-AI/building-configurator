# Building Configurator

[![MkDocs](https://github.com/THD-Spatial-AI/building-configurator/actions/workflows/docs.yml/badge.svg)](https://THD-Spatial-AI.github.io/building-configurator/)
&nbsp;
[![CodeQL](https://github.com/THD-Spatial-AI/building-configurator/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/THD-Spatial-AI/building-configurator/actions/workflows/github-code-scanning/codeql)

A practical research project exploring AI-assisted UI development workflows. The focus is on methods for generating, iterating, and evaluating UI components using AI tools, with a structured feedback loop that converts user observations into tracked issues — giving developers a clear, prioritised backlog to decide how to handle each item.

The UI itself is a building property configurator for the [EnerPlanET](https://enerplanet.th-deg.de/) platform, covering energy simulation workflows [HDCP](https://github.com/THD-Spatial-AI/hdcp-go), [BUEM](https://github.com/THD-Spatial-AI/buem), and serves as the test subject for these development methods.

## Features

- Configure building geometry, envelope elements, and thermal parameters
- Set up roof and photovoltaic (PV) system properties
- Visualise the building energy envelope and surface composition
- View simulated heating and cooling load profiles
- Step-by-step configuration workflow with live building snapshot

## Running the code

```bash
npm install
npm run dev
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to report bugs, request features, and submit pull requests.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## AI Disclaimer

This project is itself an experiment in AI-assisted development. The concept, design decisions, and development methodology are the author's own. AI tools were used for implementation: the initial UI prototype was generated with [Figma Make](https://www.figma.com/make/), and the majority of the code was written using [Claude Code](https://claude.ai/code) (Anthropic Claude Sonnet 4.6). The feedback pipeline — which captures user observations and converts them into GitHub issues — is part of the methodology being developed and tested here. All AI-generated output was reviewed, directed, and adapted by the author throughout.

## Designed and developed by

[Jay Ravani](https://github.com/jravani)

## Acknowledgments

This project is being developed in the context of the research project RENvolveIT (<https://projekte.ffg.at/projekt/5127011>).
This research was funded by CETPartnership, the Clean Energy Transition Partnership under the 2023 joint call for research proposals, co-funded by the European Commission (GA N°101069750) and with the funding organizations detailed on <https://cetpartnership.eu/funding-agencies-and-call-modules>.

<img src="docs/assets/sponsors/CETP-logo.svg" alt="CETPartnership" width="144" height="72">&nbsp;&nbsp;<img src="docs/assets/sponsors/EN_Co-fundedbytheEU_RGB_POS.png" alt="EU" width="180" height="40">
