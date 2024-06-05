# IBM Db2 for z/OS Developer Extension Change Log

## 2.1.5 - 2024/03/22
- Added support for deploying external SQL and Java stored procedures.
- Added support for executing SQL in notebook interface.
- Added support for viewing the extension in light color theme.
- Added support for filtering catalog navigation objects by all columns for databases, indexes, storage groups, stored procedures, and tables.
- Added support for displaying Java source and JAR dependencies of Java stored procedure catalog navigation objects.
- Added support for additional routine code snippets.
- Added support for displaying the Db2 subsystem location in the TUNING HISTORY view.
- Fixed an issue with connecting to Db2 connections using SSL client certificates where user ID and password were required.
- Fixed an issue with catalog navigation package objects for REST services not retrieving statements. 
- Fixed an issue with catalog navigation external SQL stored procedure objects not retrieving DDL.
- Fixed an issue with `!!` and `^=` not being formatted correctly.
- Formatted SQL statements shown in catalog navigation.
- Removed hard requirement for 64-bit Java JRE.
- Resolved various security vulnerabilities.
- Upgraded the IBM Data Server Driver for JDBC and SQLJ to version 4.32.28 to resolve Log4j vulnerability.

## 2.1.4 - 2023/12/08
- Added support for catalog navigation with global variables and REST services.
- Added support to not save the password for SQL Tuning Services servers.
- Fixed an issue for catalog navigation when browsing stored procedures with periods in the version.
- Fixed an issue for catalog navigation when browsing sequences for identity columns and implicitly created DOCID columns.
- Fixed an issue when a connection could not be retrieved when using catalog navigation after debugging a native stored procedure.
- Formatted DDL shown in catalog navigation.
- Enhanced error messages related to EXPLAIN tables when tuning SQL.
- Resolved various security vulnerabilities.

## 2.1.3 - 2023/10/13
- Fixed an incompatibility issue caused by the removal of the keytar shim in VS Code v1.83.0.
- Resolved a security vulnerability.

## 2.1.2 - 2023/09/29
- Added support for catalog navigation with aliases, sequences, table spaces, triggers, user-defined functions, and user-defined types.
- Added support for toggling between viewing and hiding implicit catalog navigation objects when applicable.
- Fixed an issue with the character conversion VS Code setting not being set.
- Fixed an issue with showing the correct error notification when a Visual Explain job fails and Chrome is not installed.
- Addressed various security vulnerabilities.

## 2.1.1 - 2023/06/23
- Added support for catalog navigation with indexes, packages, plans, stored procedures, and views.
- Added support for additional routine code snippets.
- Added support for displaying warnings on a result set in SQL results.
- Fixed an issue with Db2 13 systems being identified as Db2 12 systems.
- Fixed an issue when running SQL from the QUERY HISTORY view on macOS.
- Fixed an issue with setting lowercase current schema special register values in SQL run options.
- Fixed an issue for catalog navigation table objects with displaying the correct column length when the column type is `ROWID`.
- Fixed an issue for catalog navigation table objects where the `Data type` column was misspelled.
- Fixed an issue for catalog navigation schema objects where a schema with trailing blanks would fail to load.
- Enhanced error messages related to the language server.
- Addressed various security vulnerabilities.

## 2.1.0 - 2023/02/24
- Added support for catalog navigation with storage groups, databases, tables, and schemas.
- Added support for Access Path Advisor.
- Added support for Access Path Comparison.
- Added support for Index Advisor.
- Added support for Query Rewrite Advisor.
- Added support for SQL Annotator.
- Added support for handling invalid characters in result sets.
- Added support for refreshing the Tuning Connection Profiles view.
- Added partial support for VS Code Remote Development.
- Added a modal dialog to ask users for confirmation before sharing a tuning connection profile.
- Added VS Code version requirements to README.
- Improved SQL execution performance.
- Fixed an issue with loading the content when switching between different Visual Explain results.
- Fixed an issue when running SQL from the QUERY HISTORY view on Windows.
- Fixed an issue when debugging native stored procedures on Windows while connected to a VPN.
- Added an error notification to indicate when invalid ports are used for the Db2 SQL Service.
- Enhanced error messages related to Db2 SQL Service.
- Enhanced error messages related to SQL Tuning Services.
- Addressed various security vulnerabilities.

## 1.4.0 - 2022/05/30
- Added support for Db2 13 for z/OS SQL in syntax checking, syntax highlighting, formatting, code completion, and signature help.

## 1.3.5 - 2022/04/01
- Fixed an issue with using the extension on VS Code 1.66.

## 1.3.4 - 2022/03/15
- Added support for running SQL from the QUERY HISTORY view.
- Added support for activating the deployed native stored procedure version.
- Added support for JDBC properties up to JDBC driver version 4.29.24.
- Added links to SQL code explanations in the SQL Results view.
- Added a button to open an exported SQL result set in an editor.
- Enhanced the TUNING HISTORY view to show timestamps.
- Enhanced the security of Db2 connections by allowing the use of Windows trust store with the `sslTrustStoreType` JDBC property.
- Fixed `SYSPROC.ADMIN_COMMAND_DSN` signature help parameters.
- Addressed various security vulnerabilities.

## 1.3.3 - 2022/01/07
- Fixed Apache Log4j vulnerabilities CVE-2021-45046, CVE-2021-45105, and CVE-2021-44832.
- Updated SQL Tuning Services prerequisite in README to APAR PH42944, which includes Log4j vulnerability fixes.

## 1.3.2 - 2021/12/13
- Fixed Apache Log4j CVE-2021-44228 vulnerability.

## 1.3.1 - 2021/12/07
- Added support for tuning SQL that includes parameters and variables from within a native stored procedure (.spsql file).
- Added support for customizing SQL result set export options.
- Added support for filtering and sorting columns on the current page of SQL result set.
- Added support for previewing Visual Explain within Visual Studio Code.
- Moved the storage of Db2 connection and tuning server user credentials to the system's password manager.
- Enhanced the placeholder text and tooltip hints for EXPLAIN table action views.
- Enhanced the SQL results view to show the SQL statement in a code snippet and to show the results by default if the run was successful.
- Enhanced error messages for invalid context menu actions and unsupported JDBC drivers.
- Fixed an issue with hiding EXPLAIN table actions if the user is not an owner of the tuning profile.

## 1.3.0 - 2021/09/21
- Added support for defining tuning options.
- Added support for registering SQL Tuning Services servers.
- Added support for creating, editing, and deleting tuning connection profiles.
- Added support for creating, standardizing, and dropping EXPLAIN tables.
- Added support for running Visual Explain.
- Added support for running Statistics Advisor.
- Added support for running Capture Query Environment and saving the results to a file.
- Added support for sharing and revoking privileges for a tuning connection profile with other users.
- Added support for retaining the history of tuning actions.

## 1.2.0 - 2021/06/22
- Added a button to select a connection when no connection has been specified.
- Added formatting support to group and indent lines of related SQL code.
- Added new Execution Summary page that displays consolidated results from running multiple SQL statements.
- Added support for defining a hit count on breakpoints when using the debugger.
- Added support for sorting query history by the timestamp of the execution.
- Added support for running SQL that includes parameters and variables from within a native stored procedure (.spsql file).
- Added support for selecting multiple SQL elements on different lines and running those elements as a complete statement.
- Added support for restricting the number of rows in SQL result sets.
- Added support for null values, for retaining input values, and for suggestions in the host variable view.
- Added support for XML validation for host variable parameters input.
- Added support for launching the debugger when a password isn’t saved.
- Enhanced the Query History view to quickly identify and display failing SQL statements.
- Enhanced port setting support that allows you to specify a range of port numbers.
- Fixed an issue in which the connection was not being returned when the debugger terminates.

## 1.1.2 - 2021/03/24
- Changed the documentation link for the CREATE PROCEDURE snippet.
- Fixed an issue with using Drop duplicates to deploy a native stored procedure with a different signature.
- Fixed an issue with setting DISABLE DEBUG MODE when deploying a native stored procedure.
- Fixed an issue with using breakpoints inside a loop when debugging a native stored procedure.
- Fixed an issue with using the TIMESTAMP data type for parameters when debugging a native stored procedure.

## 1.1.1 - 2021/03/10
- Added support for using SQL run options when running or debugging native stored procedures.
- Fixed an issue with an SQL parser error against Db2 for z/OS V11 or Db2 12 function level 100 connections.
- Fixed an issue in which the debug mode setting was not saved in native stored procedure deploy options.
- Fixed an issue with the debugger terminating prematurely on some macOS systems.
- Fixed an issue with the debugger failing on the Restart action.

## 1.1.0 - 2021/02/23
- Added support for deploying, running, and debugging a native stored procedure.
- Added support for different commit and rollback options when running SQL.
- Added support for running selected SQL statements from any type of file.
- Renamed the configuration file that's used for running SQL options to `.db2devextconfig.json`.
- Relocated the Finish button to the bottom-left of configuration views.
- Fixed an issue where SQL results view title did not match the name of the file.

## 0.5.9 - 2021/02/03
- Fixed an issue with recognizing host variables that contain hyphens.
- Fixed an issue when requesting values of output host variables and indicator variables.

## 0.5.6 - 2020/12/10
- Fixed an issue with exporting SQL results data when reloading data.

## 0.5.5 - 2020/12/08
- Added two new tabs to the Connections view:
    - **Tracing**, which you use to enable and configure the JDBC driver trace.
    - **Optional**, which allows you to set JDBC properties.
- Added progress indicator for connecting to/disconnecting from Db2 and for running SQL.
- Improved how connections are automatically assigned to files.
- Eliminated the use of multiple views to display connection data and SQL results.
- Corrected relative links and updated the Add connection graphic in README.
- Fixed an issue with running an EXPLAIN statement on an explainable SQL statement.

## 0.5.1 - 2020/11/05
- Fixed character encoding for SQL results.

## 0.5.0 - 2020/10/27
- Added support for code completion and signature help for Db2 built-in functions and stored procedures.
- Added support to execute SQL.
- Added support for adding and managing connection profiles for Db2 subsystems.
- Added support for Db2 SQL syntax checking.
- Updated MERGE statement snippet.
- Updated routine statement snippets with `--#SET TERMINATOR` control statements.

## 0.1.1 - 2020/08/11
- Updated the structure of logs.

## 0.1.0 - 2020/07/28
Initial public release of IBM® Db2® for z/OS® Developer Extension.

- Syntax highlighting
- SQL snippets
